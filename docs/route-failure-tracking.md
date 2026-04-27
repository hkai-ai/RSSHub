# 路由失败追踪（Route Failure Tracking）

> 本机制用于在不引入额外存储/监控系统的前提下，让运维方与订阅方能够定期发现"最近一段时间内失败的 RSS 路径"，从而及时修正失效的订阅链接或修复路由实现。

## 1. 设计目标

| 目标           | 说明                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| **可观测性**   | 通过一个 HTTP 接口列出最近失败的请求路径，含失败次数、最后错误类型/消息、状态码    |
| **零额外依赖** | 复用项目已有的缓存模块（memory / redis），不要求 Sentry / OTEL / 第三方监控也能跑  |
| **低侵入性**   | 错误处理/缓存写入路径仅各加 1 处调用，对正常请求完全无副作用                       |
| **滑动窗口**   | 失败记录在最近一次失败后的 60 分钟内有效；持续失败 → 持续可见，恢复成功 → 立刻清除 |
| **性能优先**   | 写入全部 fire-and-forget，读取通过单 key JSON 一次拿全                             |

## 2. 数据模型

所有失败记录存放在缓存的单个 key 下：

- **存储 key**：`rsshub:failed-routes`
- **结构**：`Record<sanitizedRequestPath, FailureRecord>`
- **容器 TTL**：24 小时（仅作长期闲置时的兜底回收，不影响逐条过期语义）

`FailureRecord` 字段：

| 字段            | 类型             | 含义                                                                       |
| --------------- | ---------------- | -------------------------------------------------------------------------- |
| `requestPath`   | `string`         | 经过敏感参数脱敏的请求路径（含 query string）                              |
| `routePath`     | `string \| null` | Hono 匹配到的路由模板（如 `/github/issue/:user/:repo`），未匹配时为 `null` |
| `count`         | `number`         | 当前滑动窗口内累计失败次数                                                 |
| `firstSeenAt`   | `number`         | 第一次失败的毫秒时间戳                                                     |
| `lastSeenAt`    | `number`         | 最近一次失败的毫秒时间戳                                                   |
| `expiresAt`     | `number`         | 过期毫秒时间戳；每次失败重置为 `now + 60min`                               |
| `lastStatus`    | `number`         | 最近一次响应状态码（503 / 404 / 403 …）                                    |
| `lastError`     | `string`         | 最近一次错误消息                                                           |
| `lastErrorName` | `string`         | 最近一次错误类名                                                           |

## 3. 滑动 60 分钟过期语义

- **每次失败**：`expiresAt = now + 60min`，`count` 自增。也就是说**只要持续在失败，就持续在列表里**。
- **成功响应**：在 `cache` 中间件写入路由缓存的同一处调用 `clearFailure(requestPath)`，立即从列表移除。
- **自然过期**：60 分钟内既未再次失败、也未恢复成功，下一次 `listFailures` 调用时 lazy 删除。
- **24 小时容器 TTL**：若长时间无任何路由失败/查询活动，整个 map 由缓存自然回收，避免数据无限堆积。

## 4. 触发与跳过

错误处理器（`lib/errors/index.tsx`）在以下情况下**触发**记录：

- 任何路由抛出的 `HTTPError` / `RequestError` / `FetchError`（503）
- `RejectError`（403）
- `NotFoundError`（404，**包括用户输错路径** —— 这是预期行为，便于发现失效订阅链接）
- 其他未分类异常（默认 503）

以下情况**跳过**：

- `RequestInProgressError`：缓存竞态保护，不代表上游真正失败
- 内部端点：`/`、`/robots.txt`、`/logo.png`、`/favicon.ico`、`/healthz`、`/metrics`、`/api/*`

## 5. HTTP 接口

### `GET /api/route/failures`

列出当前滑动窗口内的失败记录，按 `lastSeenAt` 倒序。

**Query 参数**：

| 名称     | 类型 | 默认 | 上限 |
| -------- | ---- | ---- | ---- |
| `limit`  | int  | 100  | 500  |
| `offset` | int  | 0    | —    |

**响应**：

```json
{
    "total": 3,
    "generatedAt": 1714200000000,
    "items": [
        {
            "requestPath": "/twitter/user/elonmusk",
            "routePath": "/twitter/user/:id",
            "count": 12,
            "firstSeenAt": 1714198000000,
            "lastSeenAt": 1714199900000,
            "expiresAt": 1714203500000,
            "lastStatus": 503,
            "lastError": "Request timeout",
            "lastErrorName": "FetchError"
        }
    ]
}
```

**调用示例**：

```bash
curl 'http://localhost:1200/api/route/failures'
curl 'http://localhost:1200/api/route/failures?limit=20&offset=0' | jq '.items[] | {path: .requestPath, count, status: .lastStatus, err: .lastErrorName}'
```

> 若启用了 `ACCESS_KEY`，访问该接口同样需要带 `key=` 或 `code=`，与其他路由一致（access-control 中间件会作用到 `/api/*`）。

## 6. 配置

当前版本无需任何环境变量配置，开箱即用。两个常量在 `lib/utils/failure-tracker.ts` 顶部定义：

| 常量                          | 默认值           | 含义                                           |
| ----------------------------- | ---------------- | ---------------------------------------------- |
| `FAILURE_TTL_MS`              | `60 * 60 * 1000` | 单条记录的滑动 TTL                             |
| `STORE_TTL_SECONDS`           | `24 * 60 * 60`   | 容器 key 的总 TTL（仅兜底回收）                |
| `MAX_RECORDS`                 | `1000`           | 防御性容量上限，超过后按 `lastSeenAt` 升序裁剪 |
| `DEFAULT_LIMIT` / `MAX_LIMIT` | `100 / 500`      | 接口分页默认值与上限                           |

如需通过环境变量调整，可在 `lib/config.ts` 中扩展（当前未暴露）。

## 7. 性能与可靠性

- **写入路径**：`recordFailure` / `clearFailure` 全部 fire-and-forget。错误处理器和 cache 中间件**不会 await**，对响应延迟零影响。
- **同进程串行化**：内部维护一个 Promise 链，把读改写串行化，避免并发覆盖；不同请求间的写入排队执行，而非阻塞调用方。
- **存储 IO**：每次失败 = 1 次 `GET` + 1 次 `SET`。整个 map JSON 的体积上限由 `MAX_RECORDS` 控制（≤ 1000 条 ≈ 数百 KB 量级），对 redis 与 memory 都无压力。
- **缓存不可用降级**：`globalCache.status.available === false` 时所有读写直接返回，机制无声失效，不影响主流程。
- **跨进程并发**：多实例部署时存在少量 last-write-wins 竞态，最差结果是单次失败/清除被覆盖；不会导致 crash 或数据损坏。
- **敏感参数脱敏**：`access_key` / `code` / `token` / `cookie` / `password` / `auth` / `authorization` / `secret` 等 query 参数在写入前自动替换为 `***`，避免失败列表本身泄漏凭证。

## 8. 涉及文件

| 文件                           | 角色                                    |
| ------------------------------ | --------------------------------------- |
| `lib/utils/failure-tracker.ts` | 核心逻辑：读/写/清除/列表、脱敏、串行化 |
| `lib/errors/index.tsx`         | 在统一错误处理器中调用 `recordFailure`  |
| `lib/middleware/cache.ts`      | 写入路由缓存成功时调用 `clearFailure`   |
| `lib/api/route/failures.ts`    | OpenAPI/Scalar 接口定义与 handler       |
| `lib/api/index.ts`             | 注册 `/api/route/failures`              |

## 9. 未来扩展方向

- **跨进程一致**：若跨进程一致性要求变高，可改用 redis sorted set（score = lastSeenAt），用 `ZADD/ZREM/ZRANGE` 取代单 key JSON
- **接入 OTEL**：把 `total` / 错误率以 gauge 形式 export 到 Prometheus
- **配置化**：将 TTL、容量、跳过路径列表移到 `lib/config.ts`
- **告警**：在 listFailures 之上加一个轮询脚本（GitHub Actions cron），失败数突破阈值时通过 Bark / Telegram 推送
