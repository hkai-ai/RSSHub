---
name: rss-route-failures-fix
description: >-
    根据 `/api/route/failures` 返回的失效路由统计批量诊断并修复 RSSHub 路由的标准流程。
    当用户粘贴 `/api/route/failures` 的 JSON 输出（含 `routePath`、`lastError`、`lastErrorName`、`count` 等字段）
    并要求"修复对应的 path 的 rss 解析失败问题"、"修复线上失效的 rss 链接"、
    或者提到 `requestPath`/`routePath`/`lastError` 等字段时，应使用本技能。
    本技能基于一次实战修复 17 条失效路由的经验沉淀，覆盖 URL 迁移、选择器变更、
    JSON 路径变动、AJAX 化、API 下线等常见站点改版模式。
---

# RSSHub 失效路由批量修复指南

本技能针对 RSSHub `/api/route/failures` 上报的批量失效路由，给出一套从输入解析、错误分类、并发探查、统一修复到验证的标准流程。

## 适用范围（用户提供的数据形态）

用户会粘贴一段 JSON，结构如下（来自 `/api/route/failures` 接口）：

```json
{
    "items": [
        {
            "requestPath": "/langchain/blog?code=***",
            "routePath": "/langchain/blog",
            "count": 12,
            "firstSeenAt": 1777267644881,
            "lastSeenAt": 1777267766601,
            "expiresAt": 1777271366601,
            "lastStatus": 200,
            "lastError": "this route is empty, please check the original site or <a ...>create an issue</a>",
            "lastErrorName": "Error"
        }
    ]
}
```

字段含义：

| 字段            | 含义                                              |
| --------------- | ------------------------------------------------- |
| `requestPath`   | 用户实际访问路径（含 query），不参与修复          |
| `routePath`     | 路由模板，对应 `lib/routes/<namespace>/<file>.ts` |
| `count`         | 失败次数，越高越重要                              |
| `firstSeenAt`   | 首次失败时间戳                                    |
| `lastSeenAt`    | 最近一次失败时间戳                                |
| `lastStatus`    | 最近一次响应状态码（200 也可能是空 feed 错误）    |
| `lastError`     | 错误消息文本，**首要诊断信号**                    |
| `lastErrorName` | 错误类型（`Error`、`TypeError`、`FetchError` 等） |

---

## 标准修复流程

### 阶段 1：批量分类失效原因

读 `lastError`，按下表对号入座：

| `lastError` 关键短语                                                     | 根因类别            | 直觉判断                                                                     |
| ------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| `this route is empty`                                                    | 选择器失效 / URL 变 | 列表选择器空，可能站点改版或 URL 301 到新地址                                |
| `Cannot read properties of undefined (reading 'X')`                      | 数据结构假设破裂    | 嵌入 JSON（`__NEXT_DATA__`、astro-island、`__MODERN_ROUTER_DATA__`）路径变动 |
| `Could not find template data in JSON` / `Could not find ... script tag` | JSON 路径变动       | 嵌入数据 schema 重构                                                         |
| `Navigating frame was detached` / `Page closed`                          | puppeteer 不稳      | 优先尝试改用 `fetchHtmlWithFallback`，无需 puppeteer                         |
| `[GET] "..." 404 Not Found`（`FetchError`）                              | API / URL 下线      | 接口已废弃或 URL 已迁移，需重新找数据源                                      |
| `... not found - page format may have changed`                           | 正则 / 选择器失效   | 容错处理：未拿到时不应抛错，降级使用默认值                                   |
| `Publication date not found`                                             | 日期解析失败        | 容错为 `undefined` 或当前时间                                                |

**为每个失效路由建一个 TaskCreate**（按 `routePath` 命名），便于跟踪进度。

---

### 阶段 2：批量并发探查

修复前**必须先看真实当前页面**，不要凭旧路由代码猜结构。常用三件套：

#### 2.1 chrome-devtools MCP（手动深入）

适合需要看 DOM、JS 嵌入数据、跨 frame 时：

```
mcp__chrome-devtools__new_page  → 打开目标页
mcp__chrome-devtools__evaluate_script → 跑 JS 抓 selector 计数 / 取样
```

注意 isolatedContext 会复用，跨 agent 探查时常出现"切换页面后 URL 错乱"，
每次探查前用 `list_pages` + `select_page` 显式选中。

#### 2.2 Agent 并发探查（首选，适合大批量）

每个 agent 仅负责 2-4 个站点，让它们用 `WebFetch` 拿当前 HTML，并直接产出：

- 列表容器 selector
- 每个字段（标题/链接/日期/分类）的 selector
- 至少 2-3 条样本数据
- 是否 SPA 空壳的判断

**模板提示词**（按需替换站点列表）：

```
我需要为 RSSHub 修复 X 个站点的 RSS 路由。请用 WebFetch 工具访问以下页面，分析当前 HTML 结构：

1. https://A.com/blog - 之前用 SELECTOR 失效
2. https://B.com/news - 之前 JSON 路径 X 失败

对于每个网站，找出：
- 列表容器 selector 或数据来源
- 标题、链接、日期、描述 字段
- 至少 2-3 条样本数据（标题、URL、日期）

如果是 SPA 空壳，告诉我。控制在 X 字以内，每个网站一段。
```

并发原则：**单条消息发出多个 Agent 调用**，避免串行等待。

#### 2.3 WebFetch（轻量，单页用）

适合：单个 JSON 接口确认字段名、单页快速验证。

---

### 阶段 3：定位修复模式

把探查结果对应到下面 7 种常见修复模式之一：

#### 模式 A：域名 / URL 迁移

特征：旧 URL 301 到新地址，结构基本相似。

修复要点：

1. 改 handler 内 base URL
2. 同步更新 `route.url`、`namespace.ts` 的 `url`
3. `radar.source` **保留旧 URL** 同时加上新 URL，避免老订阅失效

```typescript
radar: [
    {
        source: ['www.langchain.com/blog', 'blog.langchain.dev/'], // 兼容新旧
    },
],
```

#### 模式 B：选择器整体重写（Tailwind / Framer 改版）

特征：原选择器（如 `article.card`、`[data-framer-name="X"]`）完全不存在。

修复要点：

1. **不要按 class 选**——Tailwind 类、Framer 自动生成类不稳定
2. 用结构选择器：`a[href^="/blog/"]:has(h2)`、`article:has(h2 a)`、`a.card-link[href^="/news/"]`
3. data-attr 优先：`[data-framer-name^="Featured Card"]`（前缀匹配兼容响应式变体）
4. 命中链接后再 `closest()` 找祖先卡片，从卡片内取日期/分类/图片

#### 模式 C：嵌入 JSON 路径变动

特征：`__NEXT_DATA__`、`__MODERN_ROUTER_DATA__`、`astro-island[props]` 仍存在，但旧路径取不到。

修复要点：

1. 在浏览器里用 `JSON.parse(scriptTag.text())` 后 `console.log` 实际结构
2. 写更稳健的兜底（如 `loaderData?.$?.article?.schema?.blocks || []`）
3. astro-island 的 `[type, value]` 元组**不能假设 type 永远是 1**——写通用递归 decode

#### 模式 D：列表 AJAX 化

特征：HTML 中列表容器为空 `<ul id="..."></ul>`，列表数据来自异步接口。

修复要点：

1. 打开 chrome devtools `list_network_requests` 找真正的 JSON 接口
2. 用 ofetch 直接打接口，**避开 puppeteer**

> 政府/银行/大企业站点尤其常见，JSON 接口往往就在 `<page-url>/<resource-name>.json` 或固定 API。

#### 模式 E：API 下线

特征：原 API 直接 404。

修复要点：

1. 访问站点正常导航路径找到新数据源
2. 多数站点把 JSON API 改成了 SSR 列表页，改用 cheerio 解析即可

#### 模式 F：puppeteer 不稳

特征：`Navigating frame was detached`、`Page closed`、超时。

修复要点：

1. **首选**：改用 `fetchHtmlWithFallback`（普通 fetch 失败自动降级到 `api.newsdiy.cn` 第三方浏览器服务）
2. 仅当确认页面内容**必须**经过 JS 渲染时保留 `getPuppeteerPage`
3. 永远不在 puppeteer 调用外部 API 拿不到的事拼凑——直接 fetch 接口更稳

#### 模式 G：单 item / 单期 feed

特征：landing page 只有一条记录，找不到日期等关键字段就 throw。

修复要点：

1. **不要 throw** —— 容错为 `undefined` 或当前时间
2. 全文正则匹配比 selector 稳定（如 `Published on (\d{1,2}\/\d{1,2}\/\d{2,4})`）
3. 用页面 URL + 抓到的日期作 GUID 去重

---

### 阶段 4：统一基础设施选型

#### 4.1 抓取工具优先级（自顶向下选）

| 工具                          | 适用场景                                                     |
| ----------------------------- | ------------------------------------------------------------ |
| `ofetch`                      | 站点纯 SSR、明确知道 JSON 接口                               |
| `fetchHtmlWithFallback`       | **默认首选**：失败时自动降级到第三方浏览器服务，无需配置     |
| `unlockWebsite`（BrightData） | 强反爬站点（Cloudflare Turnstile、DataDome），需用户配置 key |
| `getPuppeteerPage`            | 必须 JS 渲染 + 拦截 API 响应的极少数场景                     |

`fetchHtmlWithFallback` 已覆盖大多数过去要用 puppeteer 的场景，**优先尝试它**。

#### 4.2 容错原则（重要）

修复后的路由要尽量**返回部分数据**而非 throw：

```typescript
// 坏：找不到日期就抛错，整条 feed 失效
if (!dateMatch) {
    throw new Error('Publication date not found');
}

// 好：日期可选，feed 仍可用
let pubDate: Date | undefined;
if (dateMatch) {
    pubDate = parseDate(dateMatch[1], 'MM/DD/YYYY');
}
```

```typescript
// 坏：详情页失败拖垮整条 feed
const items = await Promise.all(list.map((item) => fetchDetail(item.link)));

// 好：详情页失败时退化为列表页字段
const items = await Promise.all(
    list.map((item) =>
        cache.tryGet(item.link, async () => {
            try {
                return await fetchDetail(item);
            } catch {
                return item;
            }
        })
    )
);
```

#### 4.3 日期解析

- 永远 `Number.isNaN(parsed.getTime())` 校验后再赋值（ESLint 强制 `Number.isNaN`，禁全局 `isNaN`）
- 解析失败时返回 `undefined` 或退化为 `firstpublishedtime` meta，再退化到当前时间
- 中文日期用 `M`/`D` 而非 `MM`/`DD`，并配合 `timezone(parsed, 8)`

#### 4.4 字符串与类型

- ESLint 禁 `${x}` 强制转换 → 用 `String(x)`
- 数组初始化必须显式类型：`const items: DataItem[] = []`
- `language: 'en' as const`（窄化为 `Language` 类型）

---

### 阶段 5：验证

每条路由修复完做一遍：

```bash
# ESLint —— 必须 exit 0
npx eslint lib/routes/<ns>/<file>.ts

# 本地 handler 测试（可选）
node --import tsx -e "
const mod = await import('./lib/routes/<ns>/<file>.ts');
const result = await mod.route.handler({ req: { param: () => undefined, query: () => undefined } });
console.log('Items:', result.item?.length);
console.log('First:', result.item?.[0]?.title);
"
```

**批量场景下**，可以一次 `npx eslint <一长串文件>` 检查所有改动。

---

## 实战经验沉淀（17 条失效路由复盘）

| 站点                            | 根因类别 | 关键修复                                                                          |
| ------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `/langchain/blog`               | A        | 域名 `blog.langchain.dev` → `www.langchain.com/blog`                              |
| `/lovable/blog`                 | B        | `main > div > main > div` → `a[href^="/blog/"]:has(h2)`                           |
| `/perplexity/blog`              | B        | `data-framer-name="Featured Card"` → `[data-framer-name^="Featured Card"]`        |
| `/minimaxi/models`              | B        | `a.card` → `div.card`，链接退化为日期 anchor                                      |
| `/lumalabs/blog/:category`      | A        | `/blog/news` 路径并入 `/news`                                                     |
| `/elevenlabs/blog`              | B        | `article.card` → `article` + `time[datetime]` 取日期                              |
| `/lovart/blog` + `/lovart/news` | B + F    | `<article>` → `a[href*="/blog/"]:has(h2,h3)`，puppeteer → `fetchHtmlWithFallback` |
| `/nyse/mac-desk-weekly-recap`   | G        | 找不到日期不再 throw，容错为当前时间                                              |
| `/quiver/blog`                  | C        | astro-island `[1, v]` → `[0, v]`，写通用递归 decode                               |
| `/capcut/resource`              | C        | `template.defaultArchive` → `article.schema.blocks[]`                             |
| `/quark/articles`               | F        | puppeteer + `__wh_data__` → `fetchHtmlWithFallback` + cheerio                     |
| `/gov/zhengce/zuixin`           | D        | HTML 列表为空 → 改打 `ZUIXINZHENGCE.json` 接口                                    |
| `/kwm/ai-latest-thinking`       | A + F    | kwm.com 已下线，迁移 `kingandwood.com`，去掉 puppeteer                            |
| `/gknautomotive/news-releases`  | A        | URL 301 到 `/en/news-and-media/latest-news-and-insights/`                         |
| `/innoscience/news`             | E        | `/search/newsList` API 404 → 抓 `/news/press-releases` 列表页                     |
| `/gasgoo/autonews`              | A + B    | `china_news` 频道并入 `market-industry`，模板 Tailwind 重写                       |

### 共性总结

1. **80% 的失效来自前端改版**（模式 A/B/C），不是临时网络问题——选择器要找稳定的，URL 也要预期会变
2. **JSON 嵌入数据的路径变化频率比想象中高**——能写通用 decode 就别写 hardcoded 路径
3. **puppeteer 是技术债**——模式 F 的修复几乎全是把 puppeteer 换掉
4. **容错优先于精确**（模式 G）——单 item feed 找不到日期就用当前时间，不要让一个字段拖垮整条 feed
5. **`fetchHtmlWithFallback` 是新默认**——它的降级链已覆盖大多数反爬场景，优先采用
6. **并发探查能把数小时的工作压缩到分钟级**——按命名空间拆分，每个 agent 2-4 个站点

---

## 快速 Checklist

### 接到任务时

- [ ] 解析用户给的 JSON，按 `lastError` 给每条路由打"根因类别"标签
- [ ] 为每条路由 `TaskCreate`
- [ ] 按命名空间分组，并发起多个 Agent 进行结构探查

### 写代码时

- [ ] 改用 `fetchHtmlWithFallback` 替换 puppeteer（除非真需要 JS 渲染）
- [ ] 选择器优先用 data-attr / 结构选择器 / 稳定语义类，不用 Tailwind / Framer 自动类
- [ ] URL 改动后同步 `namespace.ts.url`、`route.url`、`route.radar.source`（保留旧 URL）
- [ ] 找不到字段时降级而不是 throw
- [ ] 数组、对象显式类型注解
- [ ] 日期 `Number.isNaN(parsed.getTime())` 校验

### 验证时

- [ ] `npx eslint <一批文件>` 全部 exit 0
- [ ] 至少 1-2 条路由跑本地 handler 验证 item 数量
- [ ] 每个 TaskUpdate 标记 completed

---

## 与 rss-route-dev 的关系

| Skill                      | 何时用                                             |
| -------------------------- | -------------------------------------------------- |
| **rss-route-dev**          | 从 0 创建新路由，关注路由结构、字段、规范          |
| **rss-route-failures-fix** | 批量修复线上失效路由，关注根因分类、并发探查、容错 |

两者并不冲突——本技能在编写新代码时仍应遵循 `rss-route-dev` 的字段类型、缓存、标准分类等规范。
