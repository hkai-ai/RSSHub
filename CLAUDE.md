# Claude.md - RSSHub Development Guide

## Project Overview

RSSHub is an open-source RSS aggregation platform that converts various web sources into RSS feeds. It's a Node.js TypeScript project that serves as the world's largest RSS network with over 5,000 global instances.

## Development Environment Setup

### Prerequisites
1. **Node.js**: Install Node.js v22 or higher
2. **pnpm**: Package manager (version 10.15.0+)
3. **Code Editor**: VS Code, WebStorm, Neovim, or Sublime Text

### Optional VS Code Extensions
- EditorConfig (maintains consistent code style)
- ESLint (identifies and fixes code errors)
- Prettier (formats code for readability)

### Getting Started
```bash
# Install dependencies
pnpm i

# Start development server
pnpm dev

# Access local instance
# http://localhost:1200
```

## Project Structure

```
RSSHub/
├── lib/
│   ├── routes/           # All RSS route implementations
│   │   ├── [namespace]/  # Grouped by website domain
│   │   │   ├── namespace.ts    # Namespace definition
│   │   │   ├── [route].ts      # Individual route files
│   │   │   └── utils.ts        # Helper functions
│   └── middleware/       # Request processing middleware
├── assets/              # Static assets
└── docs/               # Documentation
```

## Creating New RSS Routes

### Step 1: Creating Namespace

The first step to making a new RSS route is to create a namespace. In principle, the namespace should be **the same** as the secondary domain of the main website where you are making the RSS feed. For example, if you are making an RSS feed for [https://github.com/DIYgod/RSSHub/issues](https://github.com/DIYgod/RSSHub/issues), the secondary domain is `github`. Therefore, you should create a folder named `github` under `lib/routes` as the namespace for your RSS route.

:::tip
When creating a namespace, avoid creating multiple variations for the same namespace. For example, if you are making RSS feeds for `yahoo.co.jp` and `yahoo.com`, you should use a single namespace `yahoo` rather than creating multiple namespaces like `yahoo-jp`, `yahoojp`, `yahoo.jp`, `jp.yahoo`, `yahoocojp` and so on.
:::

Once you have created a namespace for the RSS route, the next step is to create the file `namespace.ts` to define the namespace.

The file should return an object that conforms to the Namespace type through a namespace. The definition of Namespace is at [/lib/types.ts](https://github.com/DIYgod/RSSHub/blob/master/lib/types.ts#L51)

- **name**: The human-readable name of the namespace, which will be used as the title of the document
- **url**: The website URL without protocol that corresponds
- **description**: Optional, hints and additional explanations for users using this namespace, it will be inserted into the document
- **zh, zh-TW, ja**: Optional, support for languages other than English, it will be used to generate multilingual documents

```typescript
// lib/routes/github/namespace.ts
import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'GitHub',
    url: 'github.com',
    description: `
:::tip
GitHub provides some official RSS feeds:

-   Repo releases: \`https://github.com/:owner/:repo/releases.atom\`
-   Repo commits: \`https://github.com/:owner/:repo/commits.atom\`
-   User activities: \`https://github.com/:user.atom\`
-   Private feed: \`https://github.com/:user.private.atom?token=:secret\` (You can find **Subscribe to your news feed** in [dashboard](https://github.com) page after login)
-   Wiki history: \`https://github.com/:owner/:repo/wiki.atom\`
:::`,

    zh: {
        name: 'GitHub',
    },
};
```

### Step 2: Creating Route

Once you have created a namespace for the route, the next step is to create a route file to register the route.

For example, if you are making an RSS feed for GitHub Repo Issues, and assume that you want users to enter the GitHub username and repo name, if they do not enter the repo name, they will return to RSSHub. You can register your new RSS route in `/lib/routes/github/issue.ts`. The file needs to return an object that conforms to the Route type through route. The definition of Route is at [/lib/types.ts](https://github.com/DIYgod/RSSHub/blob/master/lib/types.ts).

#### Route Object Properties

- **path**: The route path, using [Hono routing](https://hono.dev/api/routing) syntax
- **name**: The human-readable name of the route, which will be used as the title of the document and should be **different from the name of the namespace**
- **url**: The website URL without protocol that corresponds
- **maintainers**: The GitHub handle of the people responsible for maintaining this route
- **example**: An example URL of the route
- **parameters**: The description of the route parameters
- **description**: Optional, hints and additional explanations for users using this route, it will be inserted into the document
- **categories**: The classification of the route, which will be written into the corresponding classification document
- **features**: Some features of the route, such as what configuration items it depends on, whether it is strict anti-crawl, whether it supports a certain function and so on
- **radar**: Can help users subscribe to your new RSS route when using [RSSHub Radar](https://github.com/DIYgod/RSSHub-Radar) or other software compatible with its format
- **handler**: The handler function of the route

Here is a complete example:

```typescript
// lib/routes/github/issue.ts
import { Route } from '@/types';

export const route: Route = {
    path: '/issue/:user/:repo/:state?/:labels?',
    categories: ['programming'],
    example: '/github/issue/vuejs/core/all/wontfix',
    parameters: {
        user: 'GitHub username',
        repo: 'GitHub repo name',
        state: 'the state of the issues. Can be either `open`, `closed`, or `all`. Default: `open`.',
        labels: 'a list of comma separated label names'
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['github.com/:user/:repo/issues', 'github.com/:user/:repo/issues/:id', 'github.com/:user/:repo'],
            target: '/issue/:user/:repo',
        },
    ],
    name: 'Repo Issues',
    maintainers: ['HenryQW', 'AndreyMZ'],
    handler,
};

async function handler(ctx) {
    // Handler implementation will be covered in the next sections
}
```

In the above example, `issue` is an exact match, `:user` is a required parameter, `:repo` is a required parameter, `:state?` and `:labels?` are optional parameters (indicated by the `?` suffix).

### Step 3: Writing Radar Rules

RSSHub Radar rules help users discover and subscribe to RSS feeds when using the [RSSHub Radar](https://github.com/DIYgod/RSSHub-Radar) browser extension. Take the RSS rule of `GitHub repository Issues` as an example:

```typescript
export const route: Route = {
    // ...
    radar: [
        {
            source: ['github.com/:user/:repo/issues', 'github.com/:user/:repo/issues/:id', 'github.com/:user/:repo'],
            target: '/issue/:user/:repo',
        },
    ],
};
```

#### `source`
The source is an *optional* field and should specify a URL path without the protocol name. If you do not want to match any URL paths, leave it blank. It will only appear in the `RSSHub for current website` option in the RSSHub Radar browser extension.

The source should be a string array. For example, if the source of `GitHub repository Issues` is `github.com/:user/:repo`, it means that when you visit `https://github.com/DIYgod/RSSHub`, it will match with `github.com/:user/:repo`. At this time, the returned result params will be: `{ user: 'DIYgod', repo: 'RSSHub'}`. The browser extension uses these parameters to establish an RSSHub feed address based on the target field.

#### `target`
The target is **optional** and is used to generate an RSSHub feed address, which can accept strings as input. If you do not want to create an RSSHub subscription address, leave this field blank.

For example, in the case of `GitHub repository Issues`, the corresponding route in RSSHub documentation would be `/github/issue/:user/:repo`.

After matching `user` in the source path with `DIYgod`, and matching `repo` with `RSSHub`, `:user` in the RSSHub route will be replaced by `DIYgod`, and `:repo` will be replaced by `RSSHub`, resulting in `/github/issue/DIYgod/RSSHub`.

#### Debugging Radar Rules
If you need to debug new rules, it is recommended that you install the browser extension. You can download extension suitable for your browser at [RSSHub Radar README](https://github.com/DIYgod/RSSHub-Radar?tab=readme-ov-file#install).

Then go to settings page of extension set your local instance's address http://localhost:1200 as your "RSSHub instance", then click "Update Now", new rules will take effect.

## Route Handler Implementation Methods

The handler function will be passed a parameter `ctx`. By the end of the function, it needs to return an object that contains the information required for RSS. You can see the APIs available for `ctx` to use in the [Hono context documentation](https://hono.dev/api/context). The type of the return value is defined here: [/lib/types.ts](https://github.com/DIYgod/RSSHub/blob/master/lib/types.ts).

We have three common methods of data acquisition:

1. [Via API](#method-1-via-api) (Recommended)
2. [Via HTML](#method-2-via-html)
3. [Using Puppeteer](#method-3-using-puppeteer)

### Method 1: Via API

You should prioritize using APIs to obtain data, as APIs are usually easier to parse and more stable than HTML.

#### Check the API Documentation
Different sites have different APIs. You can check the API documentation of the site for which you want to create an RSS feed. In this case, we will use [GitHub Issues API](https://docs.github.com/zh/rest/issues/issues#list-repository-issues).

But more often, websites do not provide open APIs. At these times, we can use browser developer tools or packet capture tools to view requests initiated by the site.

#### Basic Code Structure

```typescript
import { Route } from '@/types';
import ofetch from '@/utils/ofetch'; // Unified request library used

export const route: Route = {
    // Write the routing information introduced in the previous text here.
    handler: (ctx) => {
        // Write the routing handler function here.
    },
};
```

#### Retrieving User Input
First, we need to obtain the GitHub username and repository name from the path requested by the user. If no repository name is provided in the request, it should default to `RSSHub`:

```typescript
export const route: Route = {
    // ...
    handler: (ctx) => {
        const { user, repo = 'RSSHub' } = ctx.req.param();
    },
};
```

#### Getting Data from the API
After obtaining user input, we can use it to send requests to the API. In most cases, you need to use `ofetch` (a custom [ofetch](https://github.com/unjs/ofetch) wrapper function) in `@/utils/ofetch` to send HTTP requests:

```typescript
export const route: Route = {
    // ...
    handler: async (ctx) => {
        const { user, repo = 'RSSHub' } = ctx.req.param();

        // Send an HTTP GET request to the API and destructure the returned data object.
        const data = await ofetch(`https://api.github.com/repos/${user}/${repo}/issues`, {
            headers: {
                accept: 'application/vnd.github.html+json',
            },
        });
    },
};
```

#### Construct and Return Results
Once we have retrieved the data from the API, we need to process it further to generate an RSS feed that conforms to the RSS specification. Here is the complete example:

```typescript
import { Route } from '@/types';
import ofetch from '@/utils/ofetch'; // Unified request library used
import { parseDate } from '@/utils/parse-date'; // Tool function for parsing dates

export const route: Route = {
    // Write the routing information introduced in the previous text here.
    handler: async (ctx) => {
        const { user, repo = 'RSSHub' } = ctx.req.param();
        const data = await ofetch(`https://api.github.com/repos/${user}/${repo}/issues`, {
            headers: {
                accept: 'application/vnd.github.html+json',
            },
        });

        // extract the relevant data from the API response
        const items = data.map((item) => ({
            // item title
            title: item.title,
            // item link
            link: item.html_url,
            // item description
            description: item.body_html,
            // item publish date or time
            pubDate: parseDate(item.created_at),
            // item author, if available
            author: item.user.login,
            // item category, if available
            category: item.labels.map((label) => label.name),
        }));

        return {
            // channel title
            title: `${user}/${repo} issues`,
            // channel link
            link: `https://github.com/${user}/${repo}/issues`,
            // each feed item
            item: items,
        };
    },
};
```

### Method 2: Via HTML

If the source site does not use an API to return data, but directly renders the data into HTML for return, then we can use this method of retrieval.

#### Basic Code Structure

```typescript
import { Route } from '@/types';
import ofetch from '@/utils/ofetch'; // Unified request library used
import { load } from 'cheerio'; // An HTML parser with an API similar to jQuery

export const route: Route = {
    // Write the routing information introduced in the previous text here.
    handler: (ctx) => {
        // Write the routing handler function here.
    },
};
```

#### Getting Data from HTML
After obtaining the user input, we need to initiate a request to the webpage to retrieve the required information:

```typescript
export const route: Route = {
    // ...
    handler: async (ctx) => {
        const { user, repo = 'RSSHub' } = ctx.req.param();

        const response = await ofetch(`https://github.com/${user}/${repo}/issues`);
        const $ = load(response);

        // We use a Cheerio selector to select relevant HTML elements
        const items = $('div.js-navigation-container .flex-auto')
            // We use the `toArray()` method to retrieve all the DOM elements selected as an array.
            .toArray()
            // We use the `map()` method to traverse the array and parse the data we need from each element.
            .map((item) => {
                item = $(item);
                const a = item.find('a').first();
                return {
                    title: a.text(),
                    // We need an absolute URL for `link`, but `a.attr('href')` returns a relative URL.
                    link: `https://github.com${a.attr('href')}`,
                    pubDate: parseDate(item.find('relative-time').attr('datetime')),
                    author: item.find('.opened-by a').text(),
                    category: item
                        .find('a[id^=label]')
                        .toArray()
                        .map((item) => $(item).text()),
                };
            });

        return {
            // channel title
            title: `${user}/${repo} issues`,
            // channel link
            link: `https://github.com/${user}/${repo}/issues`,
            // each feed item
            item: items,
        };
    },
};
```

#### Fetch the Full Text
Data obtained from list HTML usually does not contain the complete article. To provide a better reading experience, we can display the full article by requesting each detail page, such as the body of each GitHub Issue.

In previous sections, we only needed to send one HTTP request to the API to get all necessary data. However, in this section, we need to send `1 + n` HTTP requests where `n` is the number of articles in the list obtained from the first request.

Some websites may not like receiving a large number of requests in a short period and return errors similar to "429 Too Many Requests". Reasonable [Use Cache](#caching) can greatly reduce such occurrences.

```typescript
import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    // Write the routing information introduced in the previous text here.
    handler: async (ctx) => {
        const baseUrl = 'https://github.com';
        const { user, repo = 'RSSHub' } = ctx.req.param();

        const response = await ofetch(`${baseUrl}/${user}/${repo}/issues`);
        const $ = load(response);

        const list = $('div.js-navigation-container .flex-auto')
            .toArray()
            .map((item) => {
                item = $(item);
                const a = item.find('a').first();
                return {
                    title: a.text(),
                    link: `${baseUrl}${a.attr('href')}`,
                    pubDate: parseDate(item.find('relative-time').attr('datetime')),
                    author: item.find('.opened-by a').text(),
                    category: item
                        .find('a[id^=label]')
                        .toArray()
                        .map((item) => $(item).text()),
                };
            });

        const items = await Promise.all(
            list.map((item) =>
                cache.tryGet(item.link, async () => {
                    const response = await ofetch(item.link);
                    const $ = load(response);

                    // Select the first element with the class name 'comment-body'
                    item.description = $('.comment-body').first().html();

                    // Every property of a list item defined above is reused here
                    // and we add a new property 'description'
                    return item;
                })
            )
        );

        return {
            title: `${user}/${repo} issues`,
            link: `https://github.com/${user}/${repo}/issues`,
            item: items,
        };
    },
};
```

### Method 3: Using Puppeteer

A small portion of websites use extremely strict anti-crawling strategies or complex encryption algorithms to prevent data acquisition. In this case, you may need to use Puppeteer to simulate browser behavior in order to obtain data.

#### Replace ofetch with puppeteer

```typescript
import { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import logger from '@/utils/logger';
import puppeteer from '@/utils/puppeteer';
import { load } from 'cheerio';

export const route: Route = {
    // ...
    handler: async (ctx) => {
        const baseUrl = 'https://github.com';
        const { user, repo = 'RSSHub' } = ctx.req.param();

        // require puppeteer utility class and initialise a browser instance
        const browser = await puppeteer();
        // open a new tab
        const page = await browser.newPage();
        // intercept all requests
        await page.setRequestInterception(true);
        // only allow certain types of requests to proceed
        page.on('request', (request) => {
            // in this case, we only allow document requests to proceed
            request.resourceType() === 'document' ? request.continue() : request.abort();
        });
        // visit the target link
        const link = `${baseUrl}/${user}/${repo}/issues`;
        // ofetch requests will be logged automatically
        // but puppeteer requests are not
        // so we need to log them manually
        logger.http(`Requesting ${link}`);
        await page.goto(link, {
            // specify how long to wait for the page to load
            waitUntil: 'domcontentloaded',
        });
        // retrieve the HTML content of the page
        const response = await page.content();
        // close the tab
        page.close();

        const $ = load(response);

        // Process HTML similar to Method 2...

        // don't forget to close the browser instance at the end of the function
        browser.close();

        return {
            // Your RSS output here
        };
    },
}
```

#### Fetch the Full Text with Puppeteer
Retrieving the full articles of each issue using a new browser page is similar to the previous section, but reusing the browser instance:

```typescript
const items = await Promise.all(
    list.map((item) =>
        cache.tryGet(item.link, async () => {
            // reuse the browser instance and open a new tab
            const page = await browser.newPage();
            // set up request interception to only allow document requests
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                request.resourceType() === 'document' ? request.continue() : request.abort();
            });

            logger.http(`Requesting ${item.link}`);
            await page.goto(item.link, {
                waitUntil: 'domcontentloaded',
            });
            const response = await page.content();
            // close the tab after retrieving the HTML content
            page.close();

            const $ = load(response);
            item.description = $('.comment-body').first().html();

            return item;
        })
    )
);

// close the browser instance after all requests are done
browser.close();
```

#### Puppeteer Best Practices

##### Intercepting Requests
When scraping web pages, you may encounter images, fonts, and other resources that you don't need. These resources can slow down the page load time and use up valuable CPU and memory resources:

```typescript
await page.setRequestInterception(true);
page.on('request', (request) => {
    request.resourceType() === 'document' ? request.continue() : request.abort();
});
// These two statements must be placed before page.goto()
```

You can find all the possible values of `request.resourceType()` [here](https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-ResourceType). When using these values in your code, make sure to use **lowercase** letters.

##### Wait Until Options
In the code above, `waitUntil: 'domcontentloaded'` is used in the `page.goto()` function. This tells Puppeteer when to consider a navigation successful:

- `domcontentloaded`: waits for a shorter time than the default value `load`
- `networkidle0`: may not be suitable for websites that keep sending background telemetry or fetching data

It's important to avoid waiting for a specific timeout and instead wait for a selector to appear. Waiting for a timeout is inaccurate, as it depends on the load of the Puppeteer instance.

Additional Resources:
- [Puppeteer's current docs](https://pptr.dev)
- [Wait Until options documentation](https://pptr.dev/api/puppeteer.page.goto/#remarks)

## Development Standards

### Script Standard

#### General Guidelines

- **Be consistent!**
- Avoid using deprecated features.
- Avoid modifying `pnpm-lock.yaml` and `package.json`, unless you add a new dependency.
- Combine repetitive code into functions.
- Prefer higher ECMAScript Standard features over lower ones.
- Sort the entries alphabetically (uppercase first) to make it easier to find an entry.
- Use HTTPS instead of HTTP whenever possible.
- Use WebP format instead of JPG whenever possible since it offers better compression.

### Code Style (Enforced by ESLint + Prettier)

#### Formatting

**Indentation:**
- Use 4 spaces for indentation for consistent and easy-to-read code.
- **Tab Width**: 4 spaces
- **Print Width**: 233 characters (Prettier setting)
- **End of Line**: LF (Linux/Unix style)

**Semicolons:**
- Add a semicolon at the end of each statement for improved readability and consistency.

**String:**
- Use single quotes instead of double quotes whenever possible for consistency and readability.
- Use [template literals](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals) over complex string concatenation and for GraphQL queries as they make the code more concise and easy to read.

**Whitespace:**
- Add an empty line at the end of each file.
- Avoid trailing whitespace for a clean and readable codebase.
- **Final Newline**: Required

#### Language Features

**Casting:**
- Avoid re-casting the same type.

**Functions:**
- Prefer [arrow functions](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Functions/Arrow_functions) over the `function` keyword.

**Loops:**
- Use `for-of` instead of `for` for arrays ([javascript:S4138](https://rules.sonarsource.com/javascript/RSPEC-4138)).
- **Await in Loops**: Avoid `await` in loops (use `Promise.all()` instead)

**Variables:**
- Use `const` and `let` instead of `var`.
- Declare one variable per declaration.

#### Modern JavaScript/TypeScript Features
```typescript
// ✅ Prefer modern array methods
items.includes(item)               // instead of indexOf
items.find(fn)                     // instead of filter + [0]
items.some(fn)                     // for existence checks

// ✅ Object shorthand
const obj = { name, value };       // instead of { name: name, value: value }

// ✅ Arrow functions
const fn = (a, b) => a + b;        // instead of function(a, b) { return a + b; }
```

### Naming Conventions
- Use `lowerCamelCase` for variables and functions to adhere to standard naming conventions.
- Use `kebab-case` for files and folders.
- Use `CONSTANT_CASE` for constants.
- **TypeScript Types**: `PascalCase`

### Specific ESLint Rules Applied

#### Error Prevention
```typescript
// Forbidden patterns
console.log('anything');           // ❌ no-console
var something = 'value';           // ❌ no-var
eval('code');                      // ❌ no-eval
await somePromise.then();          // ❌ no-await-expression-member

// Required patterns
const items = [];                  // ✅ prefer-const
items.forEach(item => {});         // ✅ prefer-arrow-callback
if (condition) { action(); }       // ✅ curly braces required
```

#### Cheerio-Specific Rules
```typescript
// ❌ Wrong - Don't use .get() without parameters
$('selector').get()

// ✅ Correct - Use .toArray()
$('selector').toArray()

// ❌ Wrong - Don't chain .map() before .toArray()
$('selector').map(fn).toArray()

// ✅ Correct - Use .toArray() first
$('selector').toArray().map(fn)
```

#### TypeScript-Specific
```typescript
// ✅ Allowed in RSSHub
// @ts-ignore comments are allowed when necessary
// any type usage is permitted for flexibility
// require() statements are allowed where needed
const module = require('some-module'); // allowed when necessary
```

### Route Standards

#### Namespace

RSSHub appends the name of all route namespace folders in front of the actual route. Route maintainers should think of the namespace as the root.

**Naming Standard:**
- Use the second-level domain (SLD) as your namespace.
- Do not create variations of the same namespace. For more information, see [Creating Namespace](#step-1-creating-namespace)

**All eligible routes under the `lib/routes` path will be automatically loaded without the need for updating the `lib/router.ts`.**

#### Rendering Templates

When rendering custom content with HTML, such as `item.description`, using [art-template](https://web.archive.org/web/20241011185323/http://aui.github.io/art-template/docs/syntax.html) for layout is mandatory.

All templates should be placed in the namespace's `templates` folder with the `.art` file extension.

**Example:**

Here's an example template file (`templates/author.art`):

```html
<div>
    <img src="{{ avatar }}" />
    {{ if link !== null }}
    <a href="{{ link }}">{{name}}</a>
    {{ else }}
    <a href="#">{{name}}</a>
    {{ /if }}
</div>
```

Usage in route code:

```typescript
import path from 'node:path';
import { art } from '@/utils/render';

const renderAuthor = (author) => art(path.join(__dirname, 'templates/author.art'), author);
```

### File Structure Rules

#### EditorConfig Settings
```ini
# Global defaults
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

# YAML files use 2-space indentation
[*.yml, *.yaml]
indent_size = 2

# JSON and Vue files use 2-space indentation
[package.json, *.vue]
indent_size = 2
```

#### File Naming
- All files and folders must use `kebab-case`
- Exception: Configuration files like `package.json`, `README.md`
- Route files: `namespace.ts`, `index.ts`, `utils.ts`
- Specific route files: `news.ts`, `search.ts`, etc.

### Key Libraries Used
- **ofetch**: HTTP requests (preferred for most cases)
- **gotScraping**: For complex proxy/scraping scenarios with browser-like headers
- **cheerio**: HTML parsing
- **dayjs**: Date manipulation
- **art-template**: HTML templating
- **puppeteer**: When JavaScript rendering or complex browser simulation needed

## Important Development Practices

### Caching

RSSHub has a cache module that expires after a short duration. You can change how long the cache lasts by modifying the `CACHE_EXPIRE` value in the `lib/config.ts` file using environment variables. However, for interfaces that have less frequently updated content, it's better to specify a longer cache expiration time using `CACHE_CONTENT_EXPIRE` instead.

For example, to retrieve the full text of the first comment for each issue, you can make a request to `${baseUrl}/${user}/${repo}/issues/${id}`, since this data is unavailable through `${baseUrl}/${user}/${repo}/issues`. It's recommended to store this data in the cache to avoid making repeated requests to the server.

Here's an example of how you can use the cache to retrieve the data:

```typescript
import cache from '@/utils/cache';

const items = await Promise.all(
    list.map((item) =>
        cache.tryGet(item.link, async () => {
            const response = await ofetch(item.link);
            const $ = load(response);

            item.description = $('.comment-body').first().html();

            return item;
        })
    )
);
```

The above code snippet shows how to use the cache to get the full text of the first comment of each issue. `cache.tryGet()` is used to determine if the data is already available within the cache. If it's not, the code retrieves the data and stores it in the cache.

The object returned from the previous statement will be reused, and an extra `description` property will be added to it. The returned cache for each `item.link` will be `{ title, link, pubDate, author, category, description }`. The next time the same path is requested, this processed cache will be used instead of making a request to the server and recomputing the data.

**Important Warning:**

Any assignments to variables that are declared outside of the `tryGet()` function will not be processed under a cache-hit scenario. For example, the following code will not work as expected:

```typescript
let x = '1';
const z = await cache.tryGet('cache:key', async () => {
    x = '2';
    const y = '3';
    return y;
})
console.log(x); // cache miss: '2', cache hit: '1'
console.log(z); // '3'
```

#### Cache API

Reference: [lib/utils/cache](https://github.com/DIYgod/RSSHub/tree/master/lib/utils/cache)

**cache.tryGet(key, getValueFunc [, maxAge [, refresh ]])**

| Parameter | Type | Description |
| ---- | ---- | ----------- |
| key  | `string` | *(Required)* The key used to store and retrieve the cache. You can use `:` as a separator to create a hierarchy. |
| getValueFunc | `function` \| `string` | *(Required)* A function that returns data to be cached when a cache miss occurs. |
| maxAge | `number` | *(Optional)* The maximum age of the cache in seconds. If not specified, `CACHE_CONTENT_EXPIRE` will be used. |
| refresh | `boolean` | *(Optional)* Whether to renew the cache expiration time when the cache is hit. `true` by default. |

**Advanced Cache Methods:**

Below are advanced methods for using cache. You should use `cache.tryGet()` most of the time.

Note that you need to use `JSON.parse()` when retrieving the cache using `cache.get()`.

**cache.get(key [, refresh ])**

| Parameter | Type | Description |
| ---- | ---- | ----------- |
| key  | `string` | *(Required)* The key used to retrieve the cache. You can use `:` as a separator to create a hierarchy. |
| refresh | `boolean` | *(Optional)* Whether to renew the cache expiration time when the cache is hit. `true` by default. |

**cache.set(key, value [, maxAge ])**

| Parameter | Type | Description |
| ---- | ---- | ----------- |
| key  | `string` | *(Required)* The key used to store the cache. You can use `:` as a separator to create a hierarchy. |
| value | `function`\| `string` | *(Required)* The value to be cached. |
| maxAge | `number` | *(Optional)* The maximum age of the cache in seconds. If not specified, `CACHE_CONTENT_EXPIRE` will be used. |

### Date Handling

Proper date handling is crucial for RSS feeds. When you visit a website, it usually provides you with a date or timestamp. This section shows you how to properly handle them in your code.

#### The Standard

**No Date:**
- **Do not** add a date when a website does not provide one. Leave the `pubDate` field undefined.
- Parse only the date and **do not add a time** to the `pubDate` field when a website provides a date but not an accurate time.

The `pubDate` field must be a:

1. [Date Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date)
2. **Not recommended. Only use for compatibility**: Strings that can be parsed correctly because their behavior can be inconsistent across deployment environments. Use `Date.parse()` with caution.

The `pubDate` passed from the route script should correspond to the time zone/time used by the server.

#### Use Utility Classes

We recommend using [day.js](https://github.com/iamkun/dayjs) for date processing and time zone adjustment. There are two related utility classes:

**Date and Time:**

The RSSHub utility class includes a wrapper for [day.js](https://github.com/iamkun/dayjs) that allows you to easily parse date strings and obtain a [Date Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date) in most cases.

```typescript
import { parseDate } from '@/utils/parse-date';

const pubDate = parseDate('2020/12/30');
// OR
const pubDate = parseDate('2020/12/30', 'YYYY/MM/DD');
```

You can refer to the [day.js documentation](https://day.js.org/docs/en/parse/string-format#list-of-all-available-parsing-tokens) for all available date formats.

If you need to parse a relative date, use `parseRelativeDate`:

```typescript
import { parseRelativeDate } from '@/utils/parse-date';

const pubDate = parseRelativeDate('2 days ago');
const pubDate = parseRelativeDate('day before yesterday 15:36');
```

**Timezone:**

When parsing dates from websites, it's important to consider time zones. Some websites may not convert the time zone according to the visitor's location, resulting in a date that doesn't accurately reflect the user's local time. To avoid this issue, you can manually specify the time zone.

To manually specify the time zone in your code, use the following:

```typescript
import timezone from '@/utils/timezone';

const pubDate = timezone(parseDate('2020/12/30 13:00'), +1);
```

The timezone function takes two parameters: the first is the original [Date Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date), and the second is the time zone offset. The offset is specified in hours, so in this example, a time zone of UTC+1 is used.

By doing this, the time will be converted to server time and it will facilitate middleware processing.

**Complete Example:**

```typescript
import { parseDate, parseRelativeDate, timezone } from '@/utils/parse-date';

// Standard date parsing
const pubDate = parseDate('2023-12-25 14:30:00');

// Relative date parsing
const pubDate = parseRelativeDate('2 days ago');

// Timezone adjustment
const pubDate = timezone(parseDate('2023-12-25 14:30:00'), +8);
```

### Error Handling
Implement proper error handling and fallbacks:

```typescript
try {
    const response = await ofetch(url);
    return response;
} catch (error) {
    if (error.response?.status === 404) {
        return null;
    }
    throw error;
}
```


## Debugging

### Console Output
Monitor console output during development for errors and warnings.

### Debug Modes
1. **JSON Debug**: Add `?format=debug.json` to route URL
2. **HTML Debug**: Add `?format={index}.debug.html` to route URL

### Debug Code Example
```typescript
// Add this to handler for debugging
const debugInfo = { items, metadata };
ctx.set('json', debugInfo);
```

## Submission Process

### Before Submitting
1. **Test Locally**: Ensure route works with `pnpm dev`
2. **Follow Standards**: Adhere to script standards and coding conventions
3. **Implement Features**:
   - Full text retrieval
   - Proper caching
   - Correct date parsing
   - Anti-bot handling (if needed)

### Pull Request Requirements
- Use "Conventional Commits" format for titles
- Include example routes with full parameters
- Complete the PR checklist
- Add documentation if needed

### PR Title Format
```
feat(route): add [Website Name] [Route Description]
```

## Advanced Features

### Feed Customization
- Support multiple output formats (RSS, Atom, JSON Feed)
- Add media RSS support for podcasts/videos
- Include custom metadata and images

### Anti-Crawler Handling
- Implement rate limiting
- Use random user agents
- Add delays between requests
- Implement retry logic

### Performance Optimization
- Use appropriate cache durations
- Implement request batching
- Optimize database queries
- Monitor memory usage

## Common Issues and Solutions

### 1. SSL/Certificate Issues
```typescript
// For simple requests
const unsecureProxyAgent = new ProxyAgent({ requestTls: { rejectUnauthorized: false } });
const unsecureFetch = ofetch.create({ dispatcher: unsecureProxyAgent });
const response = await unsecureFetch(url, {
    https: { rejectUnauthorized: false }
});

// For complex proxy/scraping scenarios
import { gotScraping } from 'got-scraping';

const response = await gotScraping({
    url: 'https://example.com',
    proxyUrl: 'http://username:password@proxy.com:8080',
    headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 87, maxVersion: 89 }],
        devices: ['desktop'],
        locales: ['en-US'],
        operatingSystems: ['windows']
    }
});
```

### 2. Rate Limiting
```typescript
// Simple delay
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

// Or use gotScraping with built-in rate limiting
const response = await gotScraping({
    url: 'https://example.com',
    retry: { limit: 3, delay: 1000 }
});
```

### 3. Complex Authentication
Check existing routes for OAuth, API key, or cookie-based authentication patterns.

## Resources

- **Documentation**: https://docs.rsshub.app/zh/joinus/
- **Route Examples**: Browse `lib/routes/` for implementation patterns
- **Community**: Telegram Group for discussions
- **Issues**: GitHub Issues for bug reports and feature requests

## Commands Reference

```bash
# Development
pnpm dev                    # Start development server
pnpm dev:cache             # Start with production cache settings

# Testing
pnpm test                  # Run all tests
pnpm vitest               # Run unit tests
pnpm vitest:watch         # Watch mode testing
pnpm vitest routes/example # Run specific route test

# Code Quality
pnpm lint                 # Run ESLint
pnpm format              # Format code with Prettier
pnpm format:check        # Check code formatting

# Building
pnpm build               # Build for production
pnpm build:docs          # Build documentation
```

This guide provides the essential information for developing RSS routes in RSSHub. Always refer to the official documentation and existing route implementations for specific patterns and best practices.

---

# RSS Feed Fundamentals

This section provides advanced users with detailed knowledge on how to create RSS feeds. If you're new to creating RSS feeds, we recommend reading the [Create Your Own RSSHub Route](#creating-new-rss-routes) section first.

Once you have collected the data you want to include in your RSS feed, you can pass it to `ctx.set('data', obj)`. RSSHub's middleware [`template.tsx`](https://github.com/DIYgod/RSSHub/blob/master/lib/middleware/template.tsx) will then process the data and render the RSS output in the required format (which is RSS 2.0 by default). In addition to the fields mentioned in the basic route creation guide, you can customize your RSS feed further using the following fields.

It's important to note that not all fields are applicable to all output formats since RSSHub supports multiple output formats. The table below shows which fields are compatible with different output formats. We use the following symbols to denote compatibility: `A` for Atom, `J` for JSON Feed, `R` for RSS 2.0.

## Channel Level Fields

The following table lists the fields you can use to customize your RSS feed at channel level:

| Field       | Description                                                                   | Default      | Compatibility |
| :---------- | :----------                                                                   | :----------- | :------------ |
| **`title`**       | *(Recommended)* The name of the feed, which should be plain text only   | `RSSHub`     | A, J, R |
| **`link`**        | *(Recommended)* The URL of the website associated with the feed, which should link to a human-readable website | `https://rsshub.app`  | A, J, R |
| **`description`** | *(Optional)* The summary of the feed, which should be plain text only   | If not specified, defaults to **`title`** | J, R |
| **`language`**    | *(Optional)* The primary language of the feed, which should be a value from [RSS Language Codes](https://www.rssboard.org/rss-language-codes) or ISO 639 language codes | `zh-cn`               | J, R |
| **`image`**       | *(Recommended)* The URL of the image that represents the channel, which should be relatively large and square | `undefined` | J, R |
| **`icon`**        | *(Optional)* The icon of an Atom feed                                   | `undefined` | J |
| **`logo`**        | *(Optional)* The logo of an RSS feed                                    | `undefined` | J |
| **`subtitle`**    | *(Optional)* The subtitle of an Atom feed                               | `undefined` | A |
| **`author`**      | *(Optional)* The author of an Atom feed or the authors of a JSON feed   | `RSSHub`     | A, J |
| **`itunes_author`** | *(Optional)* The author of a podcast feed                             | `undefined` | R |
| **`itunes_category`** | *(Optional)* The category of a podcast feed                         | `undefined` | R |
| **`itunes_explicit`** | *(Optional)* Use this to indicate that a feed contains [explicit](https://help.apple.com/itc/podcasts_connect/#/itcfafb6d665) content. | `undefined` | R |
| **`allowEmpty`** | *(Optional)* Whether to allow empty feeds. If set to `true`, the feed will be generated even if there are no items | `undefined` | A, J, R |

## Item Level Fields

Each item in an RSS feed is represented by an object with a set of fields that describe it. The table below lists the available fields:

| Field       | Description                                                                   | Default        | Compatibility |
| :---------- | :----------                                                                   | :------------- | :------------ |
| **`title`**       | *(Required)* The title of the item, which should be plain text only              | `undefined`   | A, J, R |
| **`link`**        | *(Recommended)* The URL of the item, which should link to a human-readable website | `undefined` | A, J, R |
| **`description`** | *(Recommended)* The content of the item. For an Atom feed, it's the `atom:content` element. For a JSON feed, it's the `content_html` field | `undefined` | A, J, R |
| **`author`**      | *(Optional)* The author of the item                                      | `undefined`   | A, J, R |
| **`category`**    | *(Optional)* The category of the item. You can use a plain string or an array of strings | `undefined` | A, J, R |
| **`guid`**        | *(Optional)* The unique identifier of the item                           | **`link || title`** | A, J, R |
| **`pubDate`**     | *(Recommended)* The publication date of the item, which should be a [Date object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date) following [the standard](#date-handling) | `undefined` | A, J, R |
| **`updated`**     | *(Optional)* The date of the last modification of the item, which should be a [Date object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date) | `undefined` | A, J |
| **`itunes_item_image`** | *(Optional)* The URL of an image associated with the item                           | `undefined` | R |
| **`itunes_duration`** | *(Optional)* The length of an audio or video item in seconds (or in the format H:mm:ss), which should be a number or string | `undefined` | J, R |
| **`enclosure_url`** | *(Optional)* The URL of an enclosure associated with the item                                  | `undefined` | J, R |
| **`enclosure_length`** | *(Optional)* The size of the enclosure file in **byte**, which should be a number                                | `undefined` | J, R |
| **`enclosure_type`** | *(Optional)* The MIME type of the enclosure file, which should be a string                           | `undefined` | J, R |
| **`upvotes`** | *(Optional)*  The number of upvotes the item has received, which should be a number                               | `undefined` | A |
| **`downvotes`** | *(Optional)* The number of downvotes the item has received, which should be a number                          | `undefined` | A |
| **`comments`** | *(Optional)*  The number of comments for the item, which should be a number                             | `undefined` | A |
| **`media.*`** | *(Optional)* The media associated with the item. See [Media RSS](https://www.rssboard.org/media-rss) for more details | `undefined` | R |
| **`doi`** | *(Optional)* The Digital Object Identifier of the item, which should be a string in the format `10.xxxx/xxxxx.xxxx` | `undefined` | R |

### Formatting Considerations

When specifying certain fields in an RSS feed, it's important to keep in mind some formatting considerations. Specifically, you should avoid including any linebreaks, consecutive whitespace, or leading/trailing whitespace in the following fields: **`title`**, **`subtitle`** (only for Atom), **`author`** (only for Atom), **`item.title`**, and **`item.author`**.

While most RSS readers will automatically trim these fields, some may not process them properly. Therefore, to ensure compatibility with all RSS readers, we recommend trimming these fields before outputting them. If your route cannot tolerate trimming these fields, you should consider changing their format.

Additionally, while other fields will not be forced to be trimmed, we suggest avoiding violations of the above formatting rules as much as possible. If you are using Cheerio to extract content from web pages, be aware that Cheerio will retain line breaks and indentation. For the **`item.description`** field, in particular, any intended linebreaks should be converted to `<br>` tags to prevent them from being trimmed by the RSS reader. If you're extracting an RSS feed from JSON data, be aware that the JSON may contain linebreaks that need to be displayed, so you should convert them to `<br>` tags in this case.

It's important to keep these formatting considerations in mind to ensure your RSS feed is compatible with all RSS readers.

## Create a BitTorrent/Magnet Feed

RSSHub allows you to create BitTorrent/Magnet feeds, which can be useful for triggering automated downloads. To create a BitTorrent/Magnet feed, you'll need to add **additional** fields to your RSS feed that are in accordance with many downloaders' subscription formats.

Here's an example of how to create a BitTorrent/Magnet feed:

```typescript
ctx.set('data', {
    item: [
        {
            enclosure_url: '', // This should be the Magnet URI
            enclosure_length: '', // The file size in bytes (this field is optional)
            enclosure_type: 'application/x-bittorrent', // This field should be fixed to 'application/x-bittorrent'
        },
    ],
});
```

By including these fields in your RSS feed, you'll be able to create BitTorrent/Magnet feeds that can be automatically downloaded by compatible downloaders.

### Update the documentation

If you're adding support for BitTorrent/Magnet feeds in your RSSHub route, it's important to update the documentation to reflect this change. To do this, you'll need to set the `supportBT` attribute of the `Route` component to `true`. Here's an example:

```typescript
export const route: Route = {
    // ...
    features: {
        supportBT: true,
        // other features...
    },
};
```

By setting the `supportBT` attribute to `true`, you'll be able to update your documentation to accurately reflect your route's support for BitTorrent/Magnet feeds.

## Create a Journal Feed

RSSHub supports creating journal feeds that can replace `item.link` with a Sci-hub link if users provide the [common parameter](https://docs.rsshub.app/guide/parameters#sci-hub-link) `scihub`. To create a journal feed, you'll need to include an **additional** field in your RSS feed:

```typescript
ctx.set('data', {
    item: [
        {
            doi: '', // This should be the DOI of the item (e.g., '10.47366/sabia.v5n1a3')
        },
    ],
});
```

By including this `doi` field in your RSS feed, you'll be able to create journal feeds that are compatible with RSSHub's Sci-hub functionality.

### Update the documentation

To update the documentation for your route with support for Sci-hub, you'll need to set the `supportScihub` attribute of the Route component to `true`. Here's an example:

```typescript
export const route: Route = {
    // ...
    features: {
        supportScihub: true,
        // other features...
    },
};
```

By setting the `supportScihub` attribute to `true`, the documentation for your route will accurately reflect its support for creating journal feeds with Sci-hub links.

## Create a Podcast Feed

RSSHub supports creating podcast feeds that can be used with many podcast players' subscription formats. To create a podcast feed, you'll need to include several **additional** fields in your RSS feed:

```typescript
ctx.set('data', {
    itunes_author: '', // This field is **required** and should specify the podcast author's name
    itunes_category: '', // This field specifies the channel category
    image: '', // This field specifies the channel's cover image or album art
    item: [
        {
            itunes_item_image: '', // This field specifies the item's cover image
            itunes_duration: '', // This field is optional and specifies the length of the audio in seconds or the format H:mm:ss
            enclosure_url: '', // This should be the item's direct audio link
            enclosure_length: '', // This field is optional and specifies the size of the file in **bytes**
            enclosure_type: '', // This field specifies the MIME type of the audio file (common types are 'audio/mpeg' for .mp3, 'audio/x-m4a' for .m4a, and 'video/mp4' for .mp4)
        },
    ],
});
```

By including these fields in your RSS feed, you'll be able to create podcast feeds that are compatible with many podcast players.

**Further Reading:**
- [A Podcaster's Guide to RSS](https://help.apple.com/itc/podcasts_connect/#/itcb54353390)
- [RSS feed guidelines for Google Podcasts](https://support.google.com/podcast-publishers/answer/9889544)

### Update the documentation

To update the documentation for your route with support for podcast feeds, you'll need to set the `supportPodcast` attribute of the `Route` component to `true`. Here's an example:

```typescript
export const route: Route = {
    // ...
    features: {
        supportPodcast: true,
        // other features...
    },
};
```

By setting the `supportPodcast` attribute to `true`, the documentation for your route will accurately reflect its support for creating podcast feeds.

## Create a Media Feed

RSSHub supports creating [Media RSS](https://www.rssboard.org/media-rss) feeds that are compatible with many [Media RSS](https://www.rssboard.org/media-rss) software subscription formats. To create a [Media RSS](https://www.rssboard.org/media-rss) feed, you'll need to include those **additional** fields in your RSS feed.

Here's an example of how to create a [Media RSS](https://www.rssboard.org/media-rss) feed:

```typescript
ctx.set('data', {
    item: [
        {
            media: {
                content: {
                    url: '...', // This should be the URL of the media content
                    type: '...', // This should be the MIME type of the media content (e.g., 'audio/mpeg' for an .mp3 file)
                },
                thumbnail: {
                    url: '...', // This should be the URL of the thumbnail image
                },
                '...': {
                    '...': '...', // Additional media properties can be included here
                }
            },
        },
    ],
});
```

By including these fields in your RSS feed, you'll be able to create [Media RSS](https://www.rssboard.org/media-rss) feeds that are compatible with many [Media RSS](https://www.rssboard.org/media-rss) software subscription formats.

## Create an Atom Feed with Interactions

RSSHub supports creating Atom feeds that include interactions like upvotes, downvotes, and comments. To create an Atom feed with interactions, you'll need to include **additional** fields in your RSS feed that specify the interaction counts for each item.

Here's an example of how to create an Atom feed with interactions:

```typescript
ctx.set('data', {
    item: [
        {
            upvotes: 0, // This should be the number of upvotes for this item
            downvotes: 0, // This should be the number of downvotes for this item
            comments: 0, // This should be the number of comments for this item
        },
    ],
});
```

By including these fields in your Atom feed, you'll be able to create Atom feeds with interactions that are compatible with many Atom feed readers.