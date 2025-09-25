# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RSSHub is an open-source RSS aggregation platform built with Node.js and TypeScript using the Hono framework. It converts various web sources into RSS feeds and serves as the world's largest RSS network with over 5,000 global instances.

## Development Commands

```bash
# Development
pnpm dev                    # Start development server (watch mode)
pnpm dev:cache             # Start with production cache settings

# Code Quality
pnpm lint                 # Run ESLint (cache enabled)
pnpm format              # Format with Prettier + ESLint fix
pnpm format:check        # Check formatting without changes
pnpm format:staged       # Format staged files (via lint-staged)

# Building
pnpm build               # Build for production (routes + tsdown)
pnpm build:vercel        # Build for Vercel deployment
pnpm build:docs          # Build documentation
```

## Architecture Overview

### Core Structure
- **`lib/`** - Main application code
  - **`routes/`** - RSS route implementations organized by namespace (e.g., `github/`, `twitter/`)
  - **`middleware/`** - Request processing middleware (auth, cache, rate limiting)
  - **`utils/`** - Shared utilities (ofetch, cache, date parsing, templating)
  - **`config.ts`** - Configuration management with environment variables
  - **`types.ts`** - TypeScript type definitions for Route, Namespace, etc.
  - **`registry.ts`** - Dynamic route registration system

### Key Technologies
- **Hono** - Web framework for routing and middleware
- **ofetch** - HTTP client (preferred over got/axios)
- **cheerio** - Server-side jQuery for HTML parsing
- **art-template** - HTML templating engine
- **vitest** - Testing framework
- **pnpm** - Package manager (required, do not use npm/yarn)

## Route Development Patterns

### Creating New Routes
1. **Namespace**: Create folder under `lib/routes/[domain]/` using the website's second-level domain
2. **namespace.ts**: Define namespace metadata (name, url, description)
3. **[route].ts**: Implement route with handler function
4. **Templates** (optional): Place `.art` templates in `templates/` subfolder

### Route Object Structure
```typescript
export const route: Route = {
    path: '/path/:param/:optional?',        // Hono routing syntax
    name: 'Human Readable Name',            // Different from namespace name
    categories: ['programming'],            // **Must use standard RSSHub categories only**
    example: '/github/issues/DIYgod/RSSHub', // Working example URL
    parameters: { /* param descriptions */ },
    features: { /* capabilities flags */ },
    radar: [{ /* RSSHub Radar rules */ }],
    maintainers: ['github-username'],
    handler: async (ctx) => { /* implementation */ }
};
```

### Standard RSSHub Categories
**IMPORTANT**: The `categories` field MUST only use values from the official Category type:
```typescript
export type Category =
    | 'popular'
    | 'social-media'
    | 'new-media'
    | 'traditional-media'
    | 'bbs'
    | 'blog'
    | 'programming'
    | 'design'
    | 'live'
    | 'multimedia'
    | 'picture'
    | 'anime'
    | 'program-update'
    | 'university'
    | 'forecast'
    | 'travel'
    | 'shopping'
    | 'game'
    | 'reading'
    | 'government'
    | 'study'
    | 'journal'
    | 'finance'
    | 'other';
```

**Common category mappings**:
- AI/Technology blogs: `['programming', 'new-media']`
- News sites: `['traditional-media', 'new-media']`
- Social media: `['social-media']`
- Developer content: `['programming']`
- Design content: `['design']`
- Academic content: `['university', 'study']`

### Data Fetching Methods (Priority Order)
1. **API** (preferred) - Use `ofetch` from `@/utils/ofetch` or `@/utils/got`
2. **HTML scraping** - Use `cheerio` with `ofetch` or got
3. **Puppeteer** - Only for complex JS rendering or anti-bot scenarios

### Essential Utilities
```typescript
import ofetch from '@/utils/ofetch';           // HTTP requests
import { parseDate } from '@/utils/parse-date'; // Date parsing
import cache from '@/utils/cache';             // Caching system
import { load } from 'cheerio';                // HTML parsing
import { art } from '@/utils/render';          // Template rendering
```

## Code Standards

### File Conventions
- **Naming**: Use `kebab-case` for files/folders
- **Indentation**: 4 spaces (except YAML: 2 spaces)
- **Line endings**: LF (Unix style)
- **Encoding**: UTF-8 with final newline

### TypeScript/ESLint Rules
- Use `const`/`let` instead of `var`
- Prefer arrow functions over `function` keyword
- No `console.log` (use logger from `@/utils/logger`)
- Use `?.` optional chaining where appropriate
- Cheerio: Use `.toArray()` instead of `.get()`
- **No unused variables**: Remove or use all declared variables
- **Import logger**: Always import `logger` from `@/utils/logger` for error logging
- **Type annotations**: Always provide explicit types for arrays and objects

### Caching Best Practices
```typescript
// Cache individual item details to avoid repeated requests
const items = await Promise.all(
    list.map((item) =>
        cache.tryGet(item.link, async () => {
            const response = await ofetch(item.link);
            // Process and return enriched item
            return { ...item, description: processedContent };
        })
    )
);
```

#### Cache API Reference
- **`cache.tryGet(key, getValueFunc [, maxAge [, refresh]])`** - Primary cache method
- **`cache.get(key [, refresh])`** - Get cached value (requires `JSON.parse()`)
- **`cache.set(key, value [, maxAge])`** - Set cache value
- Use `:` as separator for hierarchical keys (e.g., `github:issues:123`)

**Cache Warning**: Variables assigned outside `tryGet()` function won't be processed on cache hits

#### RSS Route Caching Requirements
- **MANDATORY for all RSS routes** - Every route MUST implement caching to avoid overwhelming target sites
- **Recommended cache duration**: 300-3600 seconds (5 minutes to 1 hour) depending on content update frequency
- **Always wrap main data fetching logic** in `cache.tryGet()` for the entire feed
```typescript
// Required pattern for all RSS routes
return await cache.tryGet(currentUrl, async () => {
    // All data fetching and processing logic here
    return { title, link, description, item: items };
}, 300); // 5-minute cache
```
- **Benefits**: Reduces server load, prevents rate limiting, improves response times, respects target site resources

## Route Registration

Routes are automatically discovered and registered from `lib/routes/` - no manual registration needed. The system scans for exported `route` objects and `namespace` objects.

## Common Debugging
- Monitor console output during `pnpm dev` for errors
- Add `?format=debug.json` to any route URL for debug output(Using ctx.set('json', obj) and must running with debugInfo=true)
- Check `logs/` directory for application logs


## Data Fetching Priority

### HTTP Client Selection
1. **ofetch** (preferred) - Use `@/utils/ofetch` for most HTTP requests
2. **got** - Use `@/utils/got` for complex proxy/scraping scenarios
3. **Puppeteer** - Only for JavaScript rendering or complex anti-bot situations

### User-Agent Configuration
- **ALWAYS use `config.ua`** - Import from `@/config` and use as User-Agent header
- **Never hardcode User-Agent strings** - Use the centralized configuration
- **Priority**: `config.ua` > custom UA > default browser UA
```typescript
import { config } from '@/config';
// For HTTP requests
headers: { 'User-Agent': config.ua }
// Puppeteer automatically uses config.ua
```

### Error Handling Best Practices
```typescript
// Graceful error handling with fallbacks
try {
    const data = await ofetch(url);
    return processData(data);
} catch (error) {
    logger.error(`Failed to fetch ${url}:`, error);
    throw new ConfigNotFoundError('Data source unavailable');
}
```

### Testing Specific Routes
```bash
pnpm vitest routes/github          # Test github namespace
pnpm vitest routes/github/issues   # Test specific route file
pnpm vitest:watch                  # Watch mode for development
```

### Date Handling Standards
- Use `parseDate()` from `@/utils/parse-date` for date parsing
- Use `parseRelativeDate()` for relative dates ("2 days ago")
- Use `timezone()` from `@/utils/timezone` for timezone adjustments
- **Never** add timestamps when websites don't provide them
- Return `Date` objects, not strings

## Advanced Route Features

### Template Rendering
Place templates in `templates/` subfolder with `.art` extension:
```typescript
import { art } from '@/utils/render';
import path from 'node:path';

const renderContent = (data) => art(path.join(__dirname, 'templates/content.art'), data);
```

### Anti-Crawler Handling
```typescript
// Rate limiting protection
await new Promise(resolve => setTimeout(resolve, 1000));

// Random user agents
import randUserAgent from '@/utils/rand-user-agent';
const headers = { 'User-Agent': randUserAgent({ browser: 'chrome' }) };

// Bright Data Unlocker for bypassing anti-bot measures
import { unlockWebsite, unlockWebsiteAsJSON } from '@/utils/bright-data-unlocker';

// Get HTML content bypassing anti-bot measures
const html = await unlockWebsite('https://example.com');

// Get JSON response with full headers and status info
const response = await unlockWebsiteAsJSON('https://example.com', { country: 'us' });
// response: { status_code: 200, headers: {...}, body: "HTML content" }
```

### Route Configuration for Bright Data Unlocker
When using Bright Data Unlocker in routes, configure required environment variables:
```typescript
export const route: Route = {
    path: '/example/:param',
    name: 'Example Route',
    categories: ['programming'],
    maintainers: ['username'],
    features: {
        requireConfig: [
            {
                name: 'BRIGHTDATA_API_KEY',
                description: 'Bright Data API key for bypassing anti-bot measures'
            },
            {
                name: 'BRIGHTDATA_UNLOCKER_ZONE',
                description: 'Bright Data zone identifier for web unlocker'
            }
        ]
    },
    handler: async (ctx) => {
        // Use Bright Data Unlocker in handler
        const html = await unlockWebsite(targetUrl);
        // Process HTML content...
    }
};
```

### Puppeteer Best Practices
```typescript
// Use getPuppeteerPage helper for simplified puppeteer usage
const { page, destory } = await getPuppeteerPage(url, {
    gotoConfig: {
        waitUntil: 'networkidle2',
        timeout: 30000,
    }
});

try {
    // Wait for specific content to load
    await page.waitForSelector('main.ant-layout-content', { timeout: 30000 });

    // Get page content
    const html = await page.content();
    const $ = load(html);

    // Process content...

} finally {
    // Always clean up resources
    await destory();
}
```

**Important Notes:**
- Always use `getPuppeteerPage()` instead of manual puppeteer setup
- The helper automatically handles browser creation, page setup, and cleanup
- Use `destory()` in the finally block to clean up resources
- Always wrap in try-finally to ensure proper cleanup
- Use `page.content()` instead of `page.evaluate(() => document.documentElement.outerHTML)`

## RSS Feed Format Support

### Channel Level Fields
| Field | Description | Default | Compatibility |
|-------|-------------|---------|---------------|
| `title` | Feed name (plain text) | `RSSHub` | A, J, R |
| `link` | Website URL | `https://rsshub.app` | A, J, R |
| `description` | Feed summary (plain text) | Defaults to `title` | J, R |
| `language` | Primary language (ISO 639) | `zh-cn` | J, R |
| `image` | Channel image URL | `undefined` | J, R |
| `icon` | Atom feed icon | `undefined` | J |
| `logo` | RSS feed logo | `undefined` | J |
| `subtitle` | Atom feed subtitle | `undefined` | A |
| `author` | Feed author | `RSSHub` | A, J |
| `itunes_author` | Podcast author | `undefined` | R |
| `itunes_category` | Podcast category | `undefined` | R |
| `itunes_explicit` | Explicit content indicator | `undefined` | R |
| `allowEmpty` | Allow empty feeds | `undefined` | A, J, R |

### Item Level Fields
| Field | Description | Default | Compatibility |
|-------|-------------|---------|---------------|
| `title` | Item title (required) | `undefined` | A, J, R |
| `link` | Item URL | `undefined` | A, J, R |
| `description` | Item content | `undefined` | A, J, R |
| `author` | Item author | `undefined` | A, J, R |
| `pubDate` | Publication date (Date object) | `undefined` | A, J, R |
| `category` | Categories (string or array) | `undefined` | A, J, R |
| `guid` | Unique identifier | `link \|\| title` | A, J, R |
| `updated` | Last modification date | `undefined` | A, J |
| `itunes_item_image` | Item image URL | `undefined` | R |
| `itunes_duration` | Audio/video length (seconds or H:mm:ss) | `undefined` | J, R |
| `enclosure_url` | Enclosure file URL | `undefined` | J, R |
| `enclosure_length` | Enclosure size in bytes | `undefined` | J, R |
| `enclosure_type` | Enclosure MIME type | `undefined` | J, R |
| `upvotes` | Number of upvotes | `undefined` | A |
| `downvotes` | Number of downvotes | `undefined` | A |
| `comments` | Number of comments | `undefined` | A |
| `media.*` | Media RSS fields | `undefined` | R |
| `doi` | Digital Object Identifier | `undefined` | R |

*Compatibility: A=Atom, J=JSON Feed, R=RSS 2.0*

## Important Notes

- Always check existing routes in similar namespaces for patterns
- Use the same HTTP client (`ofetch`) across all routes for consistency
- Implement proper error handling and graceful degradation
- Follow the established caching patterns to avoid rate limiting
- Run `pnpm lint` after code changes to ensure compliance
- Never commit changes without testing the route first
- Use `ctx.set('data', obj)` to return RSS feed data
- Format strings should avoid linebreaks in title/author fields
- Convert intended linebreaks to `<br>` tags in `description` field
- Trim whitespace from title/subtitle/author fields for RSS reader compatibility
- Set reasonable caching for each RSS route whenever possible.

## Common Development Pitfalls

### 1. Category Validation
**Problem**: Using non-standard categories that cause TypeScript errors
**Solution**: Always use the official Category type values listed above
**Example**: Don't use `['ai', 'technology']` → Use `['programming', 'new-media']`

### 2. ESLint Compliance
**Problem**: Pre-commit hooks failing due to ESLint errors
**Common issues**:
- Unused variables (remove or use all declared variables)
- Using `console.error` instead of `logger.error`
- Missing logger import

**Solutions**:
```typescript
// ✅ Correct: Import and use logger
import logger from '@/utils/logger';

// ❌ Wrong: Unused variables
const title = 'test'; // Never used
const description = 'desc'; // Never used

// ✅ Correct: Remove unused variables or use them
```

### 4. TypeScript Type Annotations
**Problem**: Missing type annotations for arrays and objects
**Solution**: Always provide explicit types for better type safety

**Examples**:
```typescript
// ❌ Wrong: No type annotation
const articles = [];
const items = [];

// ✅ Correct: Explicit type annotations
const articles: Array<{
    title: string;
    link: string;
    description: string;
    author: string;
    category: string;
    pubDate?: Date;
    image: string;
}> = [];

const items: Array<{ link: string; title: string }> = [];
```

### 5. HTML Parsing Best Practices
**Problem**: Incorrect CSS selectors based on assumed HTML structure
**Solution**: Always analyze real HTML structure before writing selectors

**Key lessons**:
- Use `children()` instead of `find()` for direct child elements
- Match specific CSS classes for accurate element identification
- Add debug logging to verify selector logic
- Never guess HTML structure - always get actual DOM

**Example pattern**:
```typescript
// ✅ Correct: Specific class matching
$('.flex-1.min-w-0.max-w-\\[1120px\\]').children().each((_, element) => {
    const $element = $(element);
    if (dateText.match(/\d{4}年\d{1,2}月\d{1,2}日/) &&
        $element.hasClass('text-[#181E25]') &&
        $element.hasClass('text-[16px]') &&
        $element.hasClass('leading-[20px]') &&
        $element.hasClass('font-[600]')) {
        // Process date element
    }
});
```

### 6. Date Parsing for Chinese Content
**Problem**: Chinese date formats failing to parse correctly
**Solution**: Use correct format strings and timezone handling

**Key patterns**:
- Chinese months and days can be single digits (e.g., "8月6日")
- Use `M` and `D` format tokens instead of `MM` and `DD`
- Always apply timezone for Chinese content (+8)

**Examples**:
```typescript
// ✅ Correct: Chinese date with timezone
const date = timezone(parseDate(dateText, 'YYYY年M月D日'), 8);

// ❌ Wrong: Incorrect format or missing timezone
const date = parseDate(dateText, 'YYYY年MM月DD日');
```

**Common Chinese date formats**:
- "2025年8月6日" → `YYYY年M月D日`
- "2025年12月25日" → `YYYY年M月D日` (works for both single and double digits)

### 3. Git Commit Process
**Problem**: Pre-commit hooks automatically format code but may fail on ESLint errors
**Solution**: Fix all ESLint errors before committing. The hooks will:
1. Run Prettier for formatting
2. Run ESLint for code quality
3. Fail if any ESLint errors remain
