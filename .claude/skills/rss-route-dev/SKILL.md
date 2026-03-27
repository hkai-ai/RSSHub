---
name: rss-route-dev
description: >-
    Complete guide for creating and debugging RSSHub RSS route implementations.
    Use this skill whenever creating a new RSS route, modifying an existing route,
    debugging route issues, or when the user mentions route development, scraping,
    cheerio selectors, date parsing, caching, or any work under lib/routes/.
    Also use when the user provides a URL and asks to create an RSS feed for it.
---

# RSSHub Route Development Guide

This skill covers the full workflow for creating RSS routes in the RSSHub project: from analyzing a target website, to writing the route handler, to passing lint and committing.

## Route Development Workflow

### Phase 1: Reconnaissance

Before writing any code, understand the target website:

1. **Fetch the page** with `WebFetch` or a subagent to understand the HTML structure
2. **Look for API endpoints** - check for JSON APIs, `__NEXT_DATA__`, RSS feeds, sitemaps
3. **Inspect the real HTML** - never guess selectors; always verify with actual page content
4. **Check for existing routes** in similar namespaces under `lib/routes/` for patterns to follow
5. **Determine the domain** - use the second-level domain as the folder name (e.g., `github` not `github.com`)

### Phase 2: Create Files

A route consists of:

```
lib/routes/[domain]/
  namespace.ts    # Required if new namespace
  [route].ts      # The route handler
  templates/      # Optional .art templates
```

**namespace.ts** (only if the namespace doesn't exist):

```typescript
import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'Site Name',
    url: 'example.com',
    lang: 'en', // Use 'as const' if TypeScript complains about string literal types
};
```

**Route file structure**:

```typescript
import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import cache from '@/utils/cache';
import { art } from '@/utils/render'; // Template rendering (optional)
import logger from '@/utils/logger'; // Error logging (use instead of console.log)

export const route: Route = {
    path: '/path/:param/:optional?',
    name: 'Human Readable Name',
    categories: ['programming'], // Must use standard categories (see below)
    example: '/domain/path/example', // A working example URL
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
    // Implementation
}
```

**RadarItem type** (for reference when writing radar rules):

```typescript
type RadarItem = {
    title?: string; // Overwrite title
    docs?: string; // Documentation URL
    source: string[]; // Source URL patterns to match
    target?: string; // Target RSSHub path (defaults to route.path)
};
```

````

### Phase 3: Implement Handler

#### Data Fetching Priority

1. **API** (best) - Use `ofetch` from `@/utils/ofetch`
2. **HTML scraping** - Use `cheerio` with `ofetch`
3. **Puppeteer** - Last resort for JS-rendered content or anti-bot scenarios

#### Handler Return Type

The handler must return a `Data` object. Pay attention to TypeScript's `Language` type for the `language` field - use `as const` to narrow string literals:

```typescript
return {
    title: 'Feed Title',
    link: 'https://example.com',
    description: 'Feed description',
    language: 'en' as const,    // Use 'as const' - plain 'en' is type string, not Language
    item: items,
};
````

#### Standard Categories

The `categories` field only accepts these values:

```
'popular' | 'social-media' | 'new-media' | 'traditional-media' | 'bbs' | 'blog'
| 'programming' | 'design' | 'live' | 'multimedia' | 'picture' | 'anime'
| 'program-update' | 'university' | 'forecast' | 'travel' | 'shopping' | 'game'
| 'reading' | 'government' | 'study' | 'journal' | 'finance' | 'other'
```

Do NOT invent categories like `'ai'` or `'technology'`.

### Phase 4: Test

Test the route handler directly before committing:

```bash
node --import tsx -e "
const mod = await import('./lib/routes/domain/route.ts');
const result = await mod.route.handler({});
console.log('Items:', result.item?.length);
console.log('First:', result.item?.[0]?.title);
"
```

Then lint:

```bash
npx eslint lib/routes/domain/route.ts
```

---

## HTML Parsing with Cheerio

### Selector Stability Rules

Selectors break when websites update. Use stable selectors in this priority order:

1. **Data attributes**: `[data-testid="article"]`, `[data-framer-name="Card"]`
2. **Text-based**: `:contains('Published on')`, `:contains('Read more')`
3. **Semantic HTML**: `article`, `nav`, `main`, `section`
4. **Stable class names**: `.article-content`, `.btn-primary` (business-logic classes)
5. **Partial class matching**: `[class*="UserInfo_container_"]` (last resort)

**Never use auto-generated classes** like `.css-1krxe8n` or `.Component__hash123` - they change on every build.

```typescript
// Good
$('[data-framer-name="Featured Card"]').first();
$('article h2:contains("Breaking")');
$('a[href^="http"][target="_blank"]');

// Bad - will break
$('.css-1krxe8n');
$('.UserBaseInfo_textInfoContainer__JNjgO');
```

### Complex CSS Selectors

Use `String.raw` for selectors with special characters:

```typescript
$(String.raw`.flex-1.min-w-0.max-w-[1120px]`);
```

### Cheerio API Notes

- Use `.toArray()` instead of `.get()` for converting to arrays
- Use `children()` for direct children vs `find()` for deep descendants
- Always verify selectors against real HTML before writing code

---

## Date Handling

### Core Rules

- Use `parseDate()` from `@/utils/parse-date` (wraps dayjs)
- Use `timezone()` from `@/utils/timezone` for timezone adjustments
- Never add timestamps when websites don't provide them
- Return `Date` objects, not strings
- When timezone is unknown, use UTC 0

### Common Patterns

```typescript
// Standard date
parseDate('2025-03-15');

// With timezone (Chinese sites = +8)
timezone(parseDate(dateText, 'YYYY年M月D日'), 8);

// Month-only dates (UTC)
timezone(parseDate('March 2026', 'MMMM YYYY'), 0);

// Ordinal dates - strip suffix first
const clean = 'September 15th, 2025'.replace(/(\d+)(st|nd|rd|th)/, '$1');
new Date(clean); // Native Date is more flexible than format strings

// Relative dates
parseRelativeDate('2 days ago');
```

### Chinese Date Formats

Use `M` and `D` (not `MM`/`DD`) - Chinese dates can be single digit:

```typescript
// "2025年8月6日" -> works with M and D
timezone(parseDate(dateText, 'YYYY年M月D日'), 8);
```

### Validation

Always validate parsed dates:

```typescript
if (Number.isNaN(date.getTime())) {
    // Handle invalid date
}
```

Use `Number.isNaN()`, not global `isNaN()` - ESLint requires this.

---

## Caching

### Default Cache

RSSHub adds a 5-minute cache to every route via middleware. For simple routes with no detail-page fetching, no additional caching is needed.

### Detail Page Caching

When fetching individual article pages, cache them to avoid repeated requests:

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

### Cache API

- `cache.tryGet(key, getValueFunc [, maxAge [, refresh]])` - primary method
- `cache.get(key [, refresh])` - raw get (needs `JSON.parse()`)
- `cache.set(key, value [, maxAge])` - raw set
- Use `:` separator for hierarchical keys: `github:issues:123`

**Gotcha**: Variables assigned outside `tryGet()` won't be updated on cache hits.

---

## RSS Feed Fields Reference

### Channel Level

| Field             | Description                | Default              | Compat |
| ----------------- | -------------------------- | -------------------- | ------ |
| `title`           | Feed name (plain text)     | `RSSHub`             | A,J,R  |
| `link`            | Website URL                | `https://rsshub.app` | A,J,R  |
| `description`     | Feed summary               | Defaults to `title`  | J,R    |
| `language`        | ISO 639 code               | `zh-cn`              | J,R    |
| `image`           | Channel image URL          | -                    | J,R    |
| `icon`            | Atom feed icon             | -                    | J      |
| `logo`            | RSS feed logo              | -                    | J      |
| `subtitle`        | Atom feed subtitle         | -                    | A      |
| `author`          | Feed author                | `RSSHub`             | A,J    |
| `allowEmpty`      | Allow empty feeds          | -                    | A,J,R  |
| `itunes_author`   | Podcast author             | -                    | R      |
| `itunes_category` | Podcast category           | -                    | R      |
| `itunes_explicit` | Explicit content indicator | -                    | R      |

### Item Level

| Field               | Description                             | Default           | Compat |
| ------------------- | --------------------------------------- | ----------------- | ------ |
| `title`             | Item title (required)                   | -                 | A,J,R  |
| `link`              | Item URL                                | -                 | A,J,R  |
| `description`       | Item content (HTML)                     | -                 | A,J,R  |
| `author`            | Item author                             | -                 | A,J,R  |
| `pubDate`           | Publication date (Date object)          | -                 | A,J,R  |
| `category`          | Categories (string[])                   | -                 | A,J,R  |
| `guid`              | Unique ID                               | `link \|\| title` | A,J,R  |
| `updated`           | Last modified date                      | -                 | A,J    |
| `itunes_item_image` | Item image URL                          | -                 | R      |
| `itunes_duration`   | Audio/video length (seconds or H:mm:ss) | -                 | J,R    |
| `enclosure_url`     | Enclosure file URL                      | -                 | J,R    |
| `enclosure_length`  | Enclosure size in bytes                 | -                 | J,R    |
| `enclosure_type`    | Enclosure MIME type                     | -                 | J,R    |
| `upvotes`           | Number of upvotes                       | -                 | A      |
| `downvotes`         | Number of downvotes                     | -                 | A      |
| `comments`          | Number of comments                      | -                 | A      |
| `media.*`           | Media RSS fields                        | -                 | R      |
| `doi`               | Digital Object Identifier               | -                 | R      |

Compatibility: A=Atom, J=JSON Feed, R=RSS 2.0

### Content Rules

- Trim whitespace from title/author fields
- No linebreaks in title/author - use `<br>` in description only
- Description supports HTML

---

## Anti-Crawler Techniques

### Random User Agent

```typescript
import randUserAgent from '@/utils/rand-user-agent';
const headers = { 'User-Agent': randUserAgent({ browser: 'chrome' }) };
```

### Bright Data Unlocker

For sites with aggressive anti-bot:

```typescript
import { unlockWebsite, unlockWebsiteAsJSON } from '@/utils/bright-data-unlocker';

// Get HTML directly
const html = await unlockWebsite('https://example.com');

// Get full response with headers and status
const response = await unlockWebsiteAsJSON('https://example.com', { country: 'us' });
// response: { status_code: 200, headers: {...}, body: "HTML content" }
```

Routes using Bright Data must declare `requireConfig` in features:

```typescript
features: {
    requireConfig: [
        { name: 'BRIGHTDATA_API_KEY', description: 'Bright Data API key' },
        { name: 'BRIGHTDATA_UNLOCKER_ZONE', description: 'Bright Data zone identifier' },
    ],
},
```

### Puppeteer

Last resort. Always use `getPuppeteerPage()` helper - never set up puppeteer manually.

```typescript
const { page, destory } = await getPuppeteerPage(url, {
    gotoConfig: { waitUntil: 'networkidle2', timeout: 30000 },
});
try {
    await page.waitForSelector('main.content', { timeout: 30000 });
    const html = await page.content(); // Use this, not page.evaluate(() => document.outerHTML)
    const $ = load(html);
    // Process...
} finally {
    await destory(); // Always clean up in finally block
}
```

**Puppeteer rules:**

- Always wrap in try-finally with `destory()` cleanup
- Use `page.content()` not `page.evaluate(() => document.documentElement.outerHTML)`
- Never use `page.waitForTimeout()` (deprecated) - use `new Promise(resolve => setTimeout(resolve, ms))`

**API Response Interception** - set up listeners in `onBeforeLoad` (before page loads):

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
    // Process apiData...
} finally {
    await destory();
}
```

**Interception anti-patterns:**

- Don't set up interceptors after page loads (too late - you'll miss the responses)
- Don't use polling loops - use Promise-based waiting
- Don't use `networkidle2` when intercepting API calls - let the interceptor handle timing
- Never guess API response structure - request actual samples first

---

## Error Handling

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

Always use `logger` from `@/utils/logger` - never `console.log` or `console.error`.

---

## ESLint & Code Quality

### Common Traps

| Issue                                  | Fix                                            |
| -------------------------------------- | ---------------------------------------------- |
| Unused imports/variables               | Remove them - ESLint will fail the commit hook |
| `console.log/error`                    | Use `logger` from `@/utils/logger`             |
| `isNaN()`                              | Use `Number.isNaN()`                           |
| Template literal coercion `` `${x}` `` | Use `String(x)`                                |
| Untyped arrays `const items = []`      | Add type: `const items: DataItem[] = []`       |
| `var` keyword                          | Use `const` or `let`                           |
| `.match()` for boolean check           | Use `.test()` instead                          |

### Type Annotations

Always provide explicit types for arrays and objects:

```typescript
// Bad
const articles = [];

// Good
const articles: Array<{
    title: string;
    link: string;
    description: string;
    pubDate?: Date;
}> = [];

// Or use DataItem from types
const items: DataItem[] = [];
```

### Workflow

1. Write code
2. Run `npx eslint lib/routes/domain/route.ts` to check your file
3. Run `pnpm lint --fix` for auto-fixes if needed
4. Trust pre-commit hooks for formatting (Prettier, CRLF -> LF)

---

## Practical Lessons from Experience

### Website Analysis

- **Always fetch real HTML** before writing selectors. Use `WebFetch`, a subagent, or a quick script to dump the HTML structure
- **Check for multiple page patterns** - listing pages and detail pages often have different structures
- **Look for data attributes** (`data-author`, `data-published`) that contain structured data via CSS pseudo-elements (`::before`/`::after`) - cheerio won't render these but the attributes are accessible

### Content Size

- Detail pages can be huge (2-5MB for research articles with embedded docs/SVGs)
- For large pages, extract only what's needed (tl;dr, summary, first few paragraphs) rather than the full HTML
- If full content is impractical, use the listing page description as fallback

### Common HTML Patterns

- **Distill-style blogs**: Use custom elements like `<d-article>`, `<d-title>` - cheerio handles these fine
- **Next.js sites**: Use `extractNextFlightObjects()` from shared utils if the site uses Next.js
- **Static sites**: Usually simplest - direct HTML parsing with cheerio
- **SPAs**: May need Puppeteer or finding the underlying API

### Simplicity Principle

- Start with the simplest approach: just parse the listing page
- Only add detail-page fetching if the listing page lacks essential info
- Only add caching if you're fetching detail pages
- Only use Puppeteer if the content requires JavaScript rendering

### Important Reminders

- Always check existing routes in similar namespaces for patterns
- Implement proper error handling and graceful degradation
- Follow the established caching patterns to avoid rate limiting
- Run `pnpm lint` after code changes to ensure compliance
- Never commit changes without testing the route first
- Set reasonable caching for each RSS route

---

## Route Development Checklist

### Before Starting

- [ ] Check for existing folder names to avoid conflicts
- [ ] Use second-level domain as folder name (e.g., `github` not `github.com`)
- [ ] Plan caching strategy

### During Implementation

- [ ] Remove unused variables/parameters
- [ ] Implement caching for detail-page fetches
- [ ] Add error handling with logger
- [ ] Use proper type annotations
- [ ] Follow RSSHub patterns from similar routes

### Before Commit

- [ ] Run `npx eslint lib/routes/domain/route.ts`
- [ ] Run `pnpm lint --fix` for auto-fixes
- [ ] Verify no ESLint errors remain
- [ ] Test the route functionality
