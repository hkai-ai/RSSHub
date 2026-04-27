---
name: rss-route-dev
description: >-
    创建和调试 RSSHub RSS 路由实现的完整指南。
    每当创建新的 RSS 路由、修改已有路由、调试路由问题，
    或者用户提到路由开发、网页爬取、cheerio 选择器、日期解析、缓存，
    或任何 lib/routes/ 目录下的工作时，都应使用本技能。
    当用户提供一个 URL 并要求为其创建 RSS feed 时也要使用。
---

# RSSHub 路由开发指南

本技能涵盖在 RSSHub 项目中创建 RSS 路由的完整流程：从分析目标网站，到编写路由处理器，再到通过 lint 检查并提交代码。

## 路由开发流程

### 阶段 1：前期调研

在写代码之前，先理解目标网站：

1. **抓取页面**：使用 `WebFetch` 或子 agent 来理解 HTML 结构
2. **寻找 API 端点**：检查是否有 JSON API、`__NEXT_DATA__`、RSS feed、sitemap
3. **查找专门的列表/归档页面**：首页通常只展示少量条目；可以查找 `/articles`、`/blog`、`/archive`、`/posts` 等罗列全部内容的路径（也可以从 sitemap.xml 寻找线索）
4. **检查真实 HTML**：永远不要凭空猜选择器；总是用真实页面内容来验证
5. **查看相似命名空间下已有的路由**：在 `lib/routes/` 中找参考模式
6. **确定域名**：使用二级域名作为目录名（例如使用 `github` 而非 `github.com`）

### 阶段 2：创建文件

一个路由由以下部分组成：

```
lib/routes/[domain]/
  namespace.ts    # 当命名空间是新增的时必须
  [route].ts      # 路由处理器
  templates/      # 可选的 .art 模板
```

**namespace.ts**（仅在该命名空间不存在时创建）：

```typescript
import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'Site Name',
    url: 'example.com',
    lang: 'en', // 当 TypeScript 抱怨字符串字面量类型时，使用 'as const'
};
```

**路由文件结构**：

```typescript
import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import cache from '@/utils/cache';
import { art } from '@/utils/render'; // 模板渲染（可选）
import logger from '@/utils/logger'; // 错误日志（用它替代 console.log）

export const route: Route = {
    path: '/path/:param/:optional?',
    name: 'Human Readable Name',
    categories: ['programming'], // 必须使用标准分类（见下文）
    example: '/domain/path/example', // 一个可用的示例 URL
    parameters: { param: 'Description' },
    radar: [
        {
            source: ['www.example.com/path/*'],
            target: '/domain/path/:param',
        },
    ],
    maintainers: ['claude'],
    handler,
    url: 'www.example.com/path',
};

async function handler(ctx) {
    // 实现
}
```

**RadarItem 类型**（编写 radar 规则时参考）：

```typescript
type RadarItem = {
    title?: string; // 覆盖标题
    docs?: string; // 文档 URL
    source: string[]; // 待匹配的源 URL 模式
    target?: string; // 目标 RSSHub 路径（默认为 route.path）
};
```

````

### 阶段 3：实现 Handler

#### 数据获取优先级

1. **API**（最佳）：使用 `@/utils/ofetch` 中的 `ofetch`
2. **HTML 抓取**：用 `cheerio` 配合 `ofetch`
3. **Puppeteer**：仅作为最后的手段，用于 JS 渲染内容或反爬场景

#### Handler 返回类型

handler 必须返回一个 `Data` 对象。注意 TypeScript 中 `language` 字段的 `Language` 类型——使用 `as const` 来收窄字符串字面量：

```typescript
return {
    title: 'Feed Title',
    link: 'https://example.com',
    description: 'Feed description',
    language: 'en' as const,    // 使用 'as const' —— 单纯的 'en' 是 string 类型，不是 Language
    item: items,
};
````

#### 标准分类

`categories` 字段只接受这些值：

```
'popular' | 'social-media' | 'new-media' | 'traditional-media' | 'bbs' | 'blog'
| 'programming' | 'design' | 'live' | 'multimedia' | 'picture' | 'anime'
| 'program-update' | 'university' | 'forecast' | 'travel' | 'shopping' | 'game'
| 'reading' | 'government' | 'study' | 'journal' | 'finance' | 'other'
```

不要自己造分类，例如 `'ai'` 或 `'technology'`。

### 阶段 4：测试与展示结果

#### 4.1 Lint

```bash
npx eslint lib/routes/domain/route.ts
```

#### 4.2 本地 handler 测试

```bash
node --import tsx -e "
const mod = await import('./lib/routes/domain/route.ts');
const result = await mod.route.handler({});
console.log('Items:', result.item?.length);
console.log('First:', result.item?.[0]?.title);
"
```

#### 4.3 向用户展示链接和样本数据

路由跑通后，始终向用户输出以下内容：

1. **生产环境 URL**（带鉴权 code）：

    ```
    https://rsshub.newsdiy.cn/<route-path>?code=<md5-hash>
    ```

    鉴权 code 为 `md5('/<route-path>' + 'yuansunkeji')`。可以这样计算：

    ```bash
    echo -n '/<route-path>yuansunkeji' | md5sum | cut -d' ' -f1
    ```

2. **本地开发环境 URL**（无需鉴权）：

    ```
    http://localhost:1200/<route-path>
    ```

3. **样本数据**：以表格形式展示测试输出中的 3-5 条 item，**每条 item 的标题、日期之外必须包含完整的文章 URL**，方便用户点击跳转验证正确性。

---

## 使用 Cheerio 解析 HTML

### 选择器稳定性规则

网站更新时选择器会失效。按以下优先级使用稳定选择器：

1. **数据属性**：`[data-testid="article"]`、`[data-framer-name="Card"]`
2. **基于文本**：`:contains('Published on')`、`:contains('Read more')`
3. **语义化 HTML**：`article`、`nav`、`main`、`section`
4. **稳定的类名**：`.article-content`、`.btn-primary`（业务逻辑相关的类）
5. **部分类名匹配**：`[class*="UserInfo_container_"]`（最后的退路）

**永远不要使用自动生成的类**，例如 `.css-1krxe8n` 或 `.Component__hash123` —— 它们每次构建都会变化。

```typescript
// 好
$('[data-framer-name="Featured Card"]').first();
$('article h2:contains("Breaking")');
$('a[href^="http"][target="_blank"]');

// 坏 —— 会失效
$('.css-1krxe8n');
$('.UserBaseInfo_textInfoContainer__JNjgO');
```

### 复杂的 CSS 选择器

含特殊字符的选择器使用 `String.raw`：

```typescript
$(String.raw`.flex-1.min-w-0.max-w-[1120px]`);
```

### Cheerio API 注意事项

- 转换为数组时使用 `.toArray()` 而非 `.get()`
- 直接子元素用 `children()`，深层后代用 `find()`
- 写代码前总是用真实 HTML 验证选择器

---

## 日期处理

### 核心规则

- 使用 `@/utils/parse-date` 中的 `parseDate()`（封装了 dayjs）
- 时区调整使用 `@/utils/timezone` 中的 `timezone()`
- 网站不提供时间戳时不要自己加
- 返回 `Date` 对象，不是字符串
- 时区未知时使用 UTC 0

### 常见模式

```typescript
// 标准日期
parseDate('2025-03-15');

// 带时区（中文站点 = +8）
timezone(parseDate(dateText, 'YYYY年M月D日'), 8);

// 仅月份的日期（UTC）
timezone(parseDate('March 2026', 'MMMM YYYY'), 0);

// 序数日期 —— 先去除后缀
const clean = 'September 15th, 2025'.replace(/(\d+)(st|nd|rd|th)/, '$1');
new Date(clean); // 原生 Date 比格式字符串更灵活

// 相对日期
parseRelativeDate('2 days ago');
```

### 中文日期格式

使用 `M` 和 `D`（不是 `MM`/`DD`）—— 中文日期可能是单个数字：

```typescript
// "2025年8月6日" -> 用 M 和 D 即可
timezone(parseDate(dateText, 'YYYY年M月D日'), 8);
```

### 校验

总是要校验解析得到的日期：

```typescript
if (Number.isNaN(date.getTime())) {
    // 处理无效日期
}
```

使用 `Number.isNaN()`，而不是全局的 `isNaN()` —— ESLint 强制要求。

---

## 缓存

### 默认缓存

RSSHub 通过中间件给每个路由加了 5 分钟的缓存。对于不抓详情页的简单路由，无需额外加缓存。

### 详情页缓存

抓取单篇文章页时，要加缓存避免重复请求：

```typescript
const items = await Promise.all(
    list.map((item) =>
        cache.tryGet(item.link, async () => {
            const response = await ofetch(item.link);
            const $ = load(response);
            return { ...item, description: $('article').html() };
        })
    )
);
```

### 缓存 API

- `cache.tryGet(key, getValueFunc [, maxAge [, refresh]])`：主要方法
- `cache.get(key [, refresh])`：原始读取（需要 `JSON.parse()`）
- `cache.set(key, value [, maxAge])`：原始写入
- 层级化的 key 使用 `:` 分隔：`github:issues:123`

**坑**：在 `tryGet()` 之外赋值的变量在缓存命中时不会被更新。

---

## RSS Feed 字段参考

### Channel 级

| 字段              | 描述                | 默认值               | 兼容性 |
| ----------------- | ------------------- | -------------------- | ------ |
| `title`           | Feed 名称（纯文本） | `RSSHub`             | A,J,R  |
| `link`            | 网站 URL            | `https://rsshub.app` | A,J,R  |
| `description`     | Feed 摘要           | 默认与 `title` 相同  | J,R    |
| `language`        | ISO 639 代码        | `zh-cn`              | J,R    |
| `image`           | Channel 图片 URL    | -                    | J,R    |
| `icon`            | Atom feed 图标      | -                    | J      |
| `logo`            | RSS feed logo       | -                    | J      |
| `subtitle`        | Atom feed 副标题    | -                    | A      |
| `author`          | Feed 作者           | `RSSHub`             | A,J    |
| `allowEmpty`      | 允许空 feed         | -                    | A,J,R  |
| `itunes_author`   | 播客作者            | -                    | R      |
| `itunes_category` | 播客分类            | -                    | R      |
| `itunes_explicit` | 显式内容标记        | -                    | R      |

### Item 级

| 字段                | 描述                       | 默认值            | 兼容性 |
| ------------------- | -------------------------- | ----------------- | ------ |
| `title`             | Item 标题（必填）          | -                 | A,J,R  |
| `link`              | Item URL                   | -                 | A,J,R  |
| `description`       | Item 内容（HTML）          | -                 | A,J,R  |
| `author`            | Item 作者                  | -                 | A,J,R  |
| `pubDate`           | 发布日期（Date 对象）      | -                 | A,J,R  |
| `category`          | 分类（string[]）           | -                 | A,J,R  |
| `guid`              | 唯一 ID                    | `link \|\| title` | A,J,R  |
| `updated`           | 最后修改时间               | -                 | A,J    |
| `itunes_item_image` | Item 图片 URL              | -                 | R      |
| `itunes_duration`   | 音视频时长（秒或 H:mm:ss） | -                 | J,R    |
| `enclosure_url`     | 附件文件 URL               | -                 | J,R    |
| `enclosure_length`  | 附件大小（字节）           | -                 | J,R    |
| `enclosure_type`    | 附件 MIME 类型             | -                 | J,R    |
| `upvotes`           | 顶数                       | -                 | A      |
| `downvotes`         | 踩数                       | -                 | A      |
| `comments`          | 评论数                     | -                 | A      |
| `media.*`           | Media RSS 字段             | -                 | R      |
| `doi`               | 数字对象标识符             | -                 | R      |

兼容性：A=Atom，J=JSON Feed，R=RSS 2.0

### 内容规则

- 标题/作者字段需修剪空白
- 标题/作者中不要换行 —— 仅 description 中可使用 `<br>`
- description 支持 HTML

---

## 反爬技术

### 随机 User Agent

```typescript
import randUserAgent from '@/utils/rand-user-agent';
const headers = { 'User-Agent': randUserAgent({ browser: 'chrome' }) };
```

### Bright Data Unlocker

针对反爬激进的站点：

```typescript
import { unlockWebsite, unlockWebsiteAsJSON } from '@/utils/bright-data-unlocker';

// 直接拿 HTML
const html = await unlockWebsite('https://example.com');

// 拿到包含 headers 和状态的完整响应
const response = await unlockWebsiteAsJSON('https://example.com', { country: 'us' });
// response: { status_code: 200, headers: {...}, body: "HTML content" }
```

使用 Bright Data 的路由必须在 features 中声明 `requireConfig`：

```typescript
features: {
    requireConfig: [
        { name: 'BRIGHTDATA_API_KEY', description: 'Bright Data API key' },
        { name: 'BRIGHTDATA_UNLOCKER_ZONE', description: 'Bright Data zone identifier' },
    ],
},
```

### Puppeteer

最后的手段。始终使用 `getPuppeteerPage()` 辅助函数 —— 永远不要手动初始化 puppeteer。

```typescript
const { page, destory } = await getPuppeteerPage(url, {
    gotoConfig: { waitUntil: 'networkidle2', timeout: 30000 },
});
try {
    await page.waitForSelector('main.content', { timeout: 30000 });
    const html = await page.content(); // 用这个，不要用 page.evaluate(() => document.outerHTML)
    const $ = load(html);
    // 处理...
} finally {
    await destory(); // 始终在 finally 中清理
}
```

**Puppeteer 规则：**

- 始终用 try-finally 包裹并在 finally 中调用 `destory()` 清理
- 用 `page.content()`，不要用 `page.evaluate(() => document.documentElement.outerHTML)`
- 永远不要用 `page.waitForTimeout()`（已废弃）—— 用 `new Promise(resolve => setTimeout(resolve, ms))`

**API 响应拦截** —— 在 `onBeforeLoad`（页面加载之前）就设置好监听器：

```typescript
let resolveApiData: (value: any) => void;
const apiDataPromise = new Promise<any>((resolve) => {
    resolveApiData = resolve;
});

const { page, destory } = await getPuppeteerPage(url, {
    onBeforeLoad: (page) => {
        page.on('response', async (response) => {
            if (response.url().startsWith('https://api.example.com/')) {
                try {
                    const data = await response.json();
                    resolveApiData(data);
                } catch (error) {
                    logger.debug('Failed to parse response:', error);
                }
            }
        });
    },
});
try {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
    });
    const apiData = await Promise.race([apiDataPromise, timeoutPromise]);
    // 处理 apiData...
} finally {
    await destory();
}
```

**拦截的反模式：**

- 不要在页面加载之后才设置拦截器（太晚了 —— 会错过响应）
- 不要使用轮询循环 —— 用基于 Promise 的等待
- 拦截 API 调用时不要用 `networkidle2` —— 让拦截器自己处理时序
- 永远不要凭空猜测 API 响应结构 —— 先请求真实样本

---

## 错误处理

```typescript
import logger from '@/utils/logger';

try {
    const data = await ofetch(url);
    return processData(data);
} catch (error) {
    logger.error(`Failed to fetch ${url}:`, error);
    throw new ConfigNotFoundError('Data source unavailable');
}
```

始终使用 `@/utils/logger` 中的 `logger` —— 不要用 `console.log` 或 `console.error`。

---

## ESLint 与代码质量

### 常见陷阱

| 问题                                | 修正方式                                 |
| ----------------------------------- | ---------------------------------------- |
| 未使用的 import/变量                | 删掉它们 —— ESLint 会让 commit hook 失败 |
| `console.log/error`                 | 使用 `@/utils/logger` 中的 `logger`      |
| `isNaN()`                           | 使用 `Number.isNaN()`                    |
| 模板字面量强制转换 `` `${x}` ``     | 使用 `String(x)`                         |
| 未声明类型的数组 `const items = []` | 加类型：`const items: DataItem[] = []`   |
| `var` 关键字                        | 使用 `const` 或 `let`                    |
| 用 `.match()` 做布尔判断            | 改用 `.test()`                           |

### 类型注解

数组和对象始终提供显式类型：

```typescript
// 坏
const articles = [];

// 好
const articles: Array<{
    title: string;
    link: string;
    description: string;
    pubDate?: Date;
}> = [];

// 或者使用 types 中的 DataItem
const items: DataItem[] = [];
```

### 工作流

1. 写代码
2. 运行 `npx eslint lib/routes/domain/route.ts` 检查文件
3. 必要时运行 `pnpm lint --fix` 进行自动修复
4. 让 pre-commit hook 处理格式化（Prettier、CRLF -> LF）

---

## 实战经验

### 网站分析

- **写选择器之前，始终抓取真实 HTML**。可以用 `WebFetch`、子 agent，或一段简短脚本来 dump HTML 结构
- **检查多种页面模式** —— 列表页和详情页的结构往往不同
- **关注数据属性**（`data-author`、`data-published`），它们经常通过 CSS 伪元素（`::before`/`::after`）承载结构化数据 —— cheerio 不会渲染这些伪元素，但属性本身是可访问的

### 内容大小

- 详情页可能很大（含嵌入文档/SVG 的研究类文章可能有 2-5MB）
- 大页面只提取需要的部分（tl;dr、摘要、前几段），而不是整页 HTML
- 如果完整内容不现实，可以用列表页的描述作为兜底

### 常见 HTML 模式

- **Distill 风格博客**：使用自定义元素如 `<d-article>`、`<d-title>` —— cheerio 处理这些没问题
- **Next.js 站点**：如果站点用 Next.js，可以用 shared utils 中的 `extractNextFlightObjects()`
- **静态站点**：通常最简单 —— 用 cheerio 直接解析 HTML
- **SPA**：可能需要 Puppeteer 或寻找底层 API

### 简洁原则

- 从最简单的方案开始：只解析列表页
- 仅在列表页缺少必要信息时才追加详情页抓取
- 仅在抓取详情页时才加缓存
- 仅在内容必须 JS 渲染时才用 Puppeteer

### 重要提醒

- 始终参考相似命名空间下已有路由的写法
- 实现合理的错误处理和优雅降级
- 遵循已有的缓存模式以避免被限流
- 代码改动后运行 `pnpm lint` 确保合规
- 没测试过的路由不要提交
- 给每个 RSS 路由设置合理的缓存

---

## 路由开发清单

### 开始之前

- [ ] 检查已有目录名以避免冲突
- [ ] 使用二级域名作为目录名（例如使用 `github` 而非 `github.com`）
- [ ] 规划缓存策略

### 实现期间

- [ ] 删除未使用的变量/参数
- [ ] 为详情页抓取实现缓存
- [ ] 用 logger 添加错误处理
- [ ] 使用合适的类型注解
- [ ] 参考相似路由遵循 RSSHub 规范

### 提交之前

- [ ] 运行 `npx eslint lib/routes/domain/route.ts`
- [ ] 运行 `pnpm lint --fix` 进行自动修复
- [ ] 确认没有遗留的 ESLint 错误
- [ ] 测试路由功能
