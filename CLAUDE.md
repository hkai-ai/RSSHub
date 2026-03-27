## Project Overview

RSSHub is an RSS aggregation platform built with Node.js and TypeScript using the Hono framework. It converts various web sources into RSS feeds and serves as the world's largest RSS network with over 5,000 global instances.

## Development Commands

```bash
# Development
pnpm dev                    # Start development server (watch mode)
pnpm dev:cache             # Start with production cache settings

# Code Quality
pnpm lint                 # Run ESLint (cache enabled)
pnpm format              # Format with Prettier + ESLint fix
pnpm format:check        # Check formatting without changes

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

## Route Registration

Routes are automatically discovered and registered from `lib/routes/` - no manual registration needed. The system scans for exported `route` objects and `namespace` objects.

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
- **Type annotations**: Always provide explicit types for arrays and objects
- **Date validation**: Use `Number.isNaN()` instead of global `isNaN()`
- **String conversion**: Use explicit `String()` instead of template literal coercion
- **CSS selector escaping**: Use `String.raw` template literals for complex CSS selectors

### Git Commit Process

Pre-commit hooks automatically handle formatting. They will:

1. Run Prettier for formatting
2. Run ESLint for code quality
3. Convert line endings (CRLF -> LF)
4. Fail if any ESLint errors remain

Trust the hooks for formatting; fix ESLint errors before committing.

## Common Debugging

- Monitor console output during `pnpm dev` for errors
- Add `?format=debug.json` to any route URL for debug output (requires debugInfo=true)
- Check `logs/` directory for application logs

## Route Development

For detailed route development guidance (creating routes, HTML parsing, date handling, caching, anti-crawler, RSS feed fields, common pitfalls), see the **rss-route-dev** skill in `.claude/skills/rss-route-dev/SKILL.md`.
