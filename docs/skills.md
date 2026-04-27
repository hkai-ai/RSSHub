# 项目 Skills 说明

> 本目录下 `.claude/skills/` 提供给 Claude Code 在处理本项目相关任务时使用的领域知识包。每个 Skill 是一份 Markdown 文档，描述特定场景的标准操作流程（SOP）、坑点与代码模板。

本文件列出当前项目内置的 Skills 及其触发与应用范围，作为快速索引。

---

## 触发机制简述

Claude Code 会在用户提问命中以下条件时主动调用对应 Skill：

1. 用户消息中包含 Skill `description` 中描述的关键场景
2. 用户在消息中显式输入 `/<skill-name>` 进行强制触发
3. 任务上下文与 Skill 描述高度匹配（如修改 `lib/routes/` 下的文件）

Skills 的源文件位于 `.claude/skills/<name>/SKILL.md`，按命名空间组织。

---

## Skill 列表

### 1. `rss-route-dev` — RSS 路由开发指南

**源文件**：`.claude/skills/rss-route-dev/SKILL.md`

**应用范围**：从 0 创建一个新的 RSS 路由，或对一条已有路由做结构性修改/调试。

**触发场景**（满足任一即可）：

- 创建新的 RSS 路由（用户给出 URL 并要求"为它做一个 RSS"）
- 修改已有路由：改字段、改选择器、调缓存策略
- 调试路由问题：选择器没命中、日期解析错误、反爬被拦
- 提到关键词："路由开发"、"网页爬取"、"cheerio 选择器"、"日期解析"、"缓存"
- 在 `lib/routes/` 目录下的任意工作

**包含内容**：

| 章节                   | 内容要点                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| 路由开发流程           | 4 个阶段：调研 → 创建文件 → 实现 handler → 测试展示                   |
| 文件结构与字段类型     | `Route` / `Namespace` / `RadarItem` 类型说明，标准 `categories` 枚举  |
| Cheerio 选择器稳定性   | data-attr → 文本 → 语义 HTML → 稳定类 → 部分匹配，**禁用自动生成类**  |
| 日期处理               | `parseDate` / `timezone` / 中文日期格式 / 校验，统一用 `Number.isNaN` |
| 缓存策略               | 默认 5 分钟中间件缓存 / 详情页缓存 / `cache.tryGet` API               |
| RSS Feed 字段参考      | Channel 级 / Item 级字段，A/J/R 兼容性表                              |
| 反爬技术分级           | 随机 UA / Bright Data Unlocker / Puppeteer（最后手段）                |
| 错误处理 / ESLint 规则 | 常见陷阱与修正：`isNaN` / 模板字面量 / 无类型数组 / `console.log`     |
| 提交清单               | 开发前 / 开发中 / 提交前 三阶段 checklist                             |

**典型用户提问**：

- "帮我为 https://example.com/blog 做一个 RSS 路由"
- "lib/routes/github/issue.ts 的 cheerio 选择器为什么没命中？"
- "RSS Feed 的 description 字段是什么类型？"
- "怎么给一个反爬严重的站点写路由？"

---

### 2. `rss-route-failures-fix` — RSS 失效路由批量修复指南

**源文件**：`.claude/skills/rss-route-failures-fix/SKILL.md`

**应用范围**：用户粘贴 `/api/route/failures` 接口的 JSON 输出，要求批量修复失效路由（典型：站点改版导致选择器/URL 失效）。

**触发场景**（满足任一即可）：

- 用户粘贴的内容包含 `routePath` / `requestPath` / `lastError` / `lastErrorName` 字段
- 用户说"修复对应的 path 的 rss 解析失败问题"、"修复线上失效的 rss 链接"
- 用户拷贝来自 [`/api/route/failures`](./route-failure-tracking.md) 的统计 JSON

**包含内容**：

| 章节             | 内容要点                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| 适用数据形态     | 明确 `/api/route/failures` JSON 各字段含义                                                               |
| 阶段 1：分类     | 按 `lastError` 关键短语对号入座到 7 种根因类别                                                           |
| 阶段 2：批量探查 | chrome-devtools MCP / 并发 Agent / WebFetch 三件套，附 Agent 提示词模板                                  |
| 阶段 3：修复模式 | A 域名迁移 / B 选择器重写 / C JSON 路径变动 / D AJAX 化 / E API 下线 / F puppeteer 不稳 / G 单 item feed |
| 阶段 4：基础设施 | `fetchHtmlWithFallback` 为新默认 / 容错优先 / 日期校验 / 类型注解                                        |
| 阶段 5：验证     | 批量 ESLint / 本地 handler 测试                                                                          |
| 实战经验沉淀     | 17 条真实失效路由的根因与修复方式对照表                                                                  |
| 共性总结         | 80% 失效来自前端改版、JSON 路径变化频率高、puppeteer 是技术债等 6 条经验                                 |

**典型用户提问**：

- 粘贴 `/api/route/failures` 的 JSON，附"请修复这些失效的 RSS 链接"
- "线上有 10 条 RSS 报错，帮我看看怎么修"
- "lastError 是 'this route is empty'，怎么处理？"

**与 `rss-route-dev` 的差异**：

| 维度       | `rss-route-dev`                | `rss-route-failures-fix`      |
| ---------- | ------------------------------ | ----------------------------- |
| **触发**   | 单条路由的开发/修改/调试       | 批量失效路由的修复            |
| **关注点** | 字段类型、选择器规范、缓存策略 | 根因分类、并发探查、容错降级  |
| **输入**   | 一个 URL 或一个路由文件        | `/api/route/failures` 的 JSON |

两者不冲突——批量修复时仍需遵循 `rss-route-dev` 的字段类型、缓存、标准分类等规范。

---

## 添加新 Skill

如需为本项目添加新 Skill：

1. 在 `.claude/skills/<skill-name>/` 创建目录
2. 写 `SKILL.md`，frontmatter 必须包含 `name` 与 `description` 两个字段
3. `description` 应清晰描述触发条件（"当用户...时使用"）
4. 在本文件追加一节说明，便于维护者快速查阅

可以使用 `skill-creator` 这个全局 Skill 辅助创建。

---

## 其它参考

- [路由失败追踪](./route-failure-tracking.md) — `/api/route/failures` 接口设计与数据模型，是 `rss-route-failures-fix` 的输入数据规范
- [项目 CLAUDE.md](../CLAUDE.md) — 项目级开发约定与命令清单
