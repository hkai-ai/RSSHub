import type { Cheerio, CheerioAPI } from 'cheerio';
import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

import { renderDescription } from './templates/description';

export const handler = async (ctx: Context): Promise<Data> => {
    const { lang = 'en' } = ctx.req.param();
    const limit: number = Number.parseInt(ctx.req.query('limit') ?? '30', 10);

    const baseUrl = 'https://www.deepl.com';
    const targetUrl: string = new URL(`${lang}/blog`, baseUrl).href;
    // DeepL 会拒绝默认 Node fetch UA，必须显式带常见浏览器 UA 才会返回正常 HTML，
    // 否则会触发 fetchHtmlWithFallback 走第三方降级，慢且不稳定。
    const browserHeaders: Record<string, string> = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
    };

    const response = await fetchHtmlWithFallback(targetUrl, { headers: browserHeaders });
    const $: CheerioAPI = load(response);
    const language = $('html').attr('lang') ?? lang;

    // DeepL 改版后列表卡片不再以 <a> 包裹，标题 h4/h6 的两层父级是普通 div，
    // 文章链接放在该 div 内的 a[href*="/blog/"]，因此原先 `$el.attr('href')`
    // 的写法只能拿到 undefined，导致整条 RSS 的 link 全部为空。
    // 这里改为：以 h4/h6 标题为锚点，向上两层取卡片容器，再从容器内取链接、
    // 时间、图片、作者，并过滤栏目页（如 /en/blog/tech）。
    const isHubPath = (href: string): boolean => /^\/[a-z-]+\/blog\/?$/i.test(href) || /^\/[a-z-]+\/blog\/(tech|business|enterprise)\/?$/i.test(href);

    let items: DataItem[] = $('h4, h6')
        .toArray()
        .map((el): DataItem | null => {
            const $title: Cheerio<Element> = $(el);
            const title: string = $title.text().trim();
            if (!title) {
                return null;
            }

            const $card: Cheerio<Element> = $title.parent().parent();
            const linkUrl: string | undefined = $card.find('a[href*="/blog/"]').first().attr('href');
            if (!linkUrl || isHubPath(linkUrl)) {
                return null;
            }

            const image: string | undefined = $card.find('img').first().attr('src');
            const intro: string = $card.find('p').first().text().trim();
            const description: string = renderDescription({
                images: image
                    ? [
                          {
                              src: image,
                              alt: title,
                          },
                      ]
                    : undefined,
                intro,
            });
            const pubDateStr: string | undefined = $card.find('time').first().attr('datetime');
            const authorsArr: string[] = $card.find('span.me-6 span').last().text().split(/,\s/).filter(Boolean);
            const authors: DataItem['author'] = authorsArr.map((author) => ({
                name: author,
                url: undefined,
                avatar: undefined,
            }));

            return {
                title,
                description,
                pubDate: pubDateStr ? parseDate(pubDateStr) : undefined,
                link: new URL(linkUrl, baseUrl).href,
                author: authors,
                content: {
                    html: description,
                    text: description,
                },
                image,
                banner: image,
                updated: pubDateStr ? parseDate(pubDateStr) : undefined,
                language,
            };
        })
        .filter((item): item is DataItem => item !== null)
        .slice(0, limit);

    items = await Promise.all(
        items.map((item) => {
            if (!item.link) {
                return item;
            }

            return cache.tryGet(item.link, async (): Promise<DataItem> => {
                try {
                    const detailResponse = await fetchHtmlWithFallback(item.link!, { headers: browserHeaders });
                    const $$: CheerioAPI = load(detailResponse);

                    const detailTitle: string = $$('h1[data-contentful-field-id="title"]').text().trim();
                    // 正文：优先用 Contentful 字段定位，旧的 `div.my-redesign-3` 仍保留为兜底。
                    const bodyHtml: string | null = $$('[data-contentful-field-id="text"]').html() ?? $$('div.my-redesign-3').html();
                    const description: string =
                        (item.description ?? '') +
                        (bodyHtml
                            ? renderDescription({
                                  description: bodyHtml,
                              })
                            : '');
                    const pubDateStr: string | undefined = $$('time').first().attr('datetime');
                    // 作者文本通常形如 `By Alice, Bob`，需要去掉 `By ` 前缀。
                    const authorsArr: string[] = $$('span[data-contentful-field-id="author"]')
                        .first()
                        .text()
                        .replace(/^\s*By\s+/i, '')
                        .split(/,\s*/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                    const authors: DataItem['author'] = authorsArr.length > 0 ? authorsArr.map((author) => ({ name: author, url: undefined, avatar: undefined })) : item.author;
                    const image: string | undefined = $$('meta[property="og:image"]').attr('content') ?? $$('picture[data-contentful-field-id="image"] img').attr('src') ?? item.image;

                    return {
                        ...item,
                        title: detailTitle || item.title,
                        description,
                        pubDate: pubDateStr ? parseDate(pubDateStr) : item.pubDate,
                        author: authors,
                        content: {
                            html: description,
                            text: description,
                        },
                        image,
                        banner: image,
                        updated: pubDateStr ? parseDate(pubDateStr) : item.updated,
                        language,
                    };
                } catch {
                    // 详情页抓取失败时退化为列表页字段，避免单条详情失败拖垮整条 feed。
                    return item;
                }
            });
        })
    );

    return {
        title: $('title').text(),
        description: $('meta[property="og:description"]').attr('content'),
        link: targetUrl,
        item: items,
        allowEmpty: true,
        image: $('meta[property="og:image"]').attr('content'),
        language,
        id: $('meta[property="og:url"]').attr('content'),
    };
};

const languageOptions = [
    {
        label: 'Deutsch',
        value: 'de',
    },
    {
        label: 'English',
        value: 'en',
    },
    {
        label: 'Español',
        value: 'es',
    },
    {
        label: '日本語',
        value: 'ja',
    },
    {
        label: 'Français',
        value: 'fr',
    },
    {
        label: 'Italiano',
        value: 'it',
    },
    {
        label: 'Bahasa Indonesia',
        value: 'id',
    },
    {
        label: '한국어',
        value: 'ko',
    },
    {
        label: 'Nederlands',
        value: 'nl',
    },
    {
        label: 'Čeština',
        value: 'cs',
    },
    {
        label: 'Svenska',
        value: 'sv',
    },
    {
        label: 'Polski',
        value: 'pl',
    },
    {
        label: 'Português (Brasil)',
        value: 'pt-BR',
    },
    {
        label: 'Português',
        value: 'pt-PT',
    },
    {
        label: 'Türkçe',
        value: 'tr',
    },
    {
        label: 'Русский',
        value: 'ru',
    },
    {
        label: '简体中文',
        value: 'zh',
    },
    {
        label: 'Українська',
        value: 'uk',
    },
    {
        label: 'العربية',
        value: 'ar',
    },
];

export const route: Route = {
    path: '/blog/:lang?',
    name: 'Blog',
    url: 'www.deepl.com',
    maintainers: ['nczitzk'],
    handler,
    example: '/deepl/blog/en',
    parameters: {
        lang: {
            description: 'Language, `en` as English by default',
            options: languageOptions,
        },
    },
    description: `::: tip
To subscribe to [Blog](https://www.deepl.com/en/blog), where the source URL is \`https://www.deepl.com/en/blog\`, extract the certain parts from this URL to be used as parameters, resulting in the route as [\`/deepl/blog/en\`](https://rsshub.app/deepl/blog/en).
:::

<details>
  <summary>More languages</summary>

| Language                                               | ID                                           |
| ------------------------------------------------------ | -------------------------------------------- |
| [Deutsch](https://www.deepl.com/de/blog)               | [de](https://rsshub.app/deepl/blog/de)       |
| [English](https://www.deepl.com/en/blog)               | [en](https://rsshub.app/deepl/blog/en)       |
| [Español](https://www.deepl.com/es/blog)               | [es](https://rsshub.app/deepl/blog/es)       |
| [日本語](https://www.deepl.com/ja/blog)                | [ja](https://rsshub.app/deepl/blog/ja)       |
| [Français](https://www.deepl.com/fr/blog)              | [fr](https://rsshub.app/deepl/blog/fr)       |
| [Italiano](https://www.deepl.com/it/blog)              | [it](https://rsshub.app/deepl/blog/it)       |
| [Bahasa Indonesia](https://www.deepl.com/id/blog)      | [id](https://rsshub.app/deepl/blog/id)       |
| [한국어](https://www.deepl.com/ko/blog)                | [ko](https://rsshub.app/deepl/blog/ko)       |
| [Nederlands](https://www.deepl.com/nl/blog)            | [nl](https://rsshub.app/deepl/blog/nl)       |
| [Čeština](https://www.deepl.com/cs/blog)               | [cs](https://rsshub.app/deepl/blog/cs)       |
| [Svenska](https://www.deepl.com/sv/blog)               | [sv](https://rsshub.app/deepl/blog/sv)       |
| [Polski](https://www.deepl.com/pl/blog)                | [pl](https://rsshub.app/deepl/blog/pl)       |
| [Português (Brasil)](https://www.deepl.com/pt-BR/blog) | [pt-BR](https://rsshub.app/deepl/blog/pt-BR) |
| [Português](https://www.deepl.com/pt-PT/blog)          | [pt-PT](https://rsshub.app/deepl/blog/pt-PT) |
| [Türkçe](https://www.deepl.com/tr/blog)                | [tr](https://rsshub.app/deepl/blog/tr)       |
| [Русский](https://www.deepl.com/ru/blog)               | [ru](https://rsshub.app/deepl/blog/ru)       |
| [简体中文](https://www.deepl.com/zh/blog)              | [zh](https://rsshub.app/deepl/blog/zh)       |
| [Українська](https://www.deepl.com/uk/blog)            | [uk](https://rsshub.app/deepl/blog/uk)       |
| [العربية](https://www.deepl.com/ar/blog)               | [ar](https://rsshub.app/deepl/blog/ar)       |

</details>
`,
    categories: ['new-media'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.deepl.com/:lang/blog'],
            target: (params) => {
                const lang: string = params.lang;

                return `/deepl/blog${lang ? `/${lang}` : ''}`;
            },
        },
        {
            title: 'Deutsch',
            source: ['www.deepl.com/de/blog'],
            target: '/blog/de',
        },
        {
            title: 'English',
            source: ['www.deepl.com/en/blog'],
            target: '/blog/en',
        },
        {
            title: 'Español',
            source: ['www.deepl.com/es/blog'],
            target: '/blog/es',
        },
        {
            title: '日本語',
            source: ['www.deepl.com/ja/blog'],
            target: '/blog/ja',
        },
        {
            title: 'Français',
            source: ['www.deepl.com/fr/blog'],
            target: '/blog/fr',
        },
        {
            title: 'Italiano',
            source: ['www.deepl.com/it/blog'],
            target: '/blog/it',
        },
        {
            title: 'Bahasa Indonesia',
            source: ['www.deepl.com/id/blog'],
            target: '/blog/id',
        },
        {
            title: '한국어',
            source: ['www.deepl.com/ko/blog'],
            target: '/blog/ko',
        },
        {
            title: 'Nederlands',
            source: ['www.deepl.com/nl/blog'],
            target: '/blog/nl',
        },
        {
            title: 'Čeština',
            source: ['www.deepl.com/cs/blog'],
            target: '/blog/cs',
        },
        {
            title: 'Svenska',
            source: ['www.deepl.com/sv/blog'],
            target: '/blog/sv',
        },
        {
            title: 'Polski',
            source: ['www.deepl.com/pl/blog'],
            target: '/blog/pl',
        },
        {
            title: 'Português (Brasil)',
            source: ['www.deepl.com/pt-BR/blog'],
            target: '/blog/pt-BR',
        },
        {
            title: 'Português',
            source: ['www.deepl.com/pt-PT/blog'],
            target: '/blog/pt-PT',
        },
        {
            title: 'Türkçe',
            source: ['www.deepl.com/tr/blog'],
            target: '/blog/tr',
        },
        {
            title: 'Русский',
            source: ['www.deepl.com/ru/blog'],
            target: '/blog/ru',
        },
        {
            title: '简体中文',
            source: ['www.deepl.com/zh/blog'],
            target: '/blog/zh',
        },
        {
            title: 'Українська',
            source: ['www.deepl.com/uk/blog'],
            target: '/blog/uk',
        },
        {
            title: 'العربية',
            source: ['www.deepl.com/ar/blog'],
            target: '/blog/ar',
        },
    ],
    view: ViewType.Articles,

    zh: {
        path: '/blog/:lang?',
        name: '博客',
        url: 'www.deepl.com',
        maintainers: ['nczitzk'],
        handler,
        example: '/deepl/blog/en',
        parameters: {
            lang: {
                description: '语言，默认为 `en`，可在对应语言页 URL 中找到',
                options: languageOptions,
            },
        },
        description: `::: tip
若订阅 [博客](https://www.deepl.com/zh/blog)，网址为 \`https://www.deepl.com/zh/blog\`，请截取 \`https://www.deepl.com/\` 到末尾 \`/blog\` 的部分 \`zh\` 作为 \`lang\` 参数填入，此时目标路由为 [\`/deepl/blog/zh\`](https://rsshub.app/deepl/blog/zh)。

:::

<details>
  <summary>更多语言</summary>

| Language                                               | ID                                           |
| ------------------------------------------------------ | -------------------------------------------- |
| [Deutsch](https://www.deepl.com/de/blog)               | [de](https://rsshub.app/deepl/blog/de)       |
| [English](https://www.deepl.com/en/blog)               | [en](https://rsshub.app/deepl/blog/en)       |
| [Español](https://www.deepl.com/es/blog)               | [es](https://rsshub.app/deepl/blog/es)       |
| [日本語](https://www.deepl.com/ja/blog)                | [ja](https://rsshub.app/deepl/blog/ja)       |
| [Français](https://www.deepl.com/fr/blog)              | [fr](https://rsshub.app/deepl/blog/fr)       |
| [Italiano](https://www.deepl.com/it/blog)              | [it](https://rsshub.app/deepl/blog/it)       |
| [Bahasa Indonesia](https://www.deepl.com/id/blog)      | [id](https://rsshub.app/deepl/blog/id)       |
| [한국어](https://www.deepl.com/ko/blog)                | [ko](https://rsshub.app/deepl/blog/ko)       |
| [Nederlands](https://www.deepl.com/nl/blog)            | [nl](https://rsshub.app/deepl/blog/nl)       |
| [Čeština](https://www.deepl.com/cs/blog)               | [cs](https://rsshub.app/deepl/blog/cs)       |
| [Svenska](https://www.deepl.com/sv/blog)               | [sv](https://rsshub.app/deepl/blog/sv)       |
| [Polski](https://www.deepl.com/pl/blog)                | [pl](https://rsshub.app/deepl/blog/pl)       |
| [Português (Brasil)](https://www.deepl.com/pt-BR/blog) | [pt-BR](https://rsshub.app/deepl/blog/pt-BR) |
| [Português](https://www.deepl.com/pt-PT/blog)          | [pt-PT](https://rsshub.app/deepl/blog/pt-PT) |
| [Türkçe](https://www.deepl.com/tr/blog)                | [tr](https://rsshub.app/deepl/blog/tr)       |
| [Русский](https://www.deepl.com/ru/blog)               | [ru](https://rsshub.app/deepl/blog/ru)       |
| [简体中文](https://www.deepl.com/zh/blog)              | [zh](https://rsshub.app/deepl/blog/zh)       |
| [Українська](https://www.deepl.com/uk/blog)            | [uk](https://rsshub.app/deepl/blog/uk)       |
| [العربية](https://www.deepl.com/ar/blog)               | [ar](https://rsshub.app/deepl/blog/ar)       |

</details>
`,
    },
};
