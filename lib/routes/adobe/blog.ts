import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/blog/:topic?',
    categories: ['blog'],
    example: '/adobe/blog/adobe-firefly',
    parameters: {
        topic: 'Topic name (optional), e.g., adobe-firefly, creative-cloud',
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
            source: ['blog.adobe.com/en/topics/:topic', 'blog.adobe.com'],
            target: '/blog/:topic',
        },
    ],
    name: 'Blog',
    maintainers: [],
    handler,
    url: 'blog.adobe.com',
    description: 'Get Adobe blog posts, optionally filtered by topic',
};

// Excel date serial epoch offset: days between 1899-12-30 (Excel epoch) and 1970-01-01 (JS epoch)
const EXCEL_EPOCH_OFFSET = 25569;
const MS_PER_DAY = 86_400_000;

export interface AdobeQueryIndexItem {
    date?: string | number;
    title?: string;
    path?: string;
    description?: string;
    author?: string;
    tags?: string | string[];
    image?: string;
}

export const parseAdobeBlogItems = (rawItems: AdobeQueryIndexItem[], topic?: string) => {
    const topicTag = topic
        ? topic
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
        : undefined;
    const topicAliases = topicTag ? new Set([topicTag.toLowerCase(), ...(topicTag.toLowerCase().startsWith('adobe ') ? [topicTag.slice(6).toLowerCase()] : [])]) : undefined;

    let items = rawItems;
    if (topicAliases) {
        items = items.filter((item) => {
            if (!item.tags) {
                return false;
            }
            try {
                const tags: string[] = Array.isArray(item.tags) ? item.tags : JSON.parse(item.tags);
                return tags.some((tag) => topicAliases.has(String(tag).toLowerCase()));
            } catch {
                return false;
            }
        });
    }

    return items
        .map((item) => {
            let pubDate: Date | undefined;
            if (item.date !== undefined && item.date !== null && item.date !== '') {
                const serial = typeof item.date === 'number' ? item.date : Number.parseInt(item.date, 10);
                if (!Number.isNaN(serial)) {
                    pubDate = new Date((serial - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
                }
            }

            return {
                title: item.title || 'Untitled',
                link: `https://blog.adobe.com${item.path}`,
                description: item.description && item.description !== '0' ? item.description : '',
                pubDate,
                author: item.author || '',
                image: item.image ? `https://blog.adobe.com${item.image}` : undefined,
            };
        })
        .toSorted((a, b) => (b.pubDate?.getTime() ?? 0) - (a.pubDate?.getTime() ?? 0));
};

async function handler(ctx) {
    const { topic } = ctx.req.param();
    const limit = Number.parseInt(ctx.req.query('limit'), 10) || (topic ? 1000 : 500);
    const offsetParam = ctx.req.query('offset');

    const apiUrl = 'https://blog.adobe.com/en/query-index.json';
    let offset = offsetParam === undefined ? undefined : Number.parseInt(offsetParam, 10) || 0;

    // Adobe's query-index.json appends newer entries toward the end; when no explicit offset is
    // provided, read total first and fetch the newest tail window so topic filters find recent posts.
    if (offset === undefined) {
        const meta = await ofetch<{ total?: number }>(apiUrl, { query: { limit: 1, offset: 0 } });
        const total = Number(meta?.total || 0);
        offset = total > limit ? total - limit : 0;
    }

    const response = await ofetch<{ data?: AdobeQueryIndexItem[] }>(apiUrl, {
        query: {
            limit,
            offset,
        },
    });

    const feedItems = parseAdobeBlogItems(response.data || [], topic);

    const title = topic ? `Adobe Blog - ${topic.replaceAll('-', ' ')}` : 'Adobe Blog';
    const link = topic ? `https://blog.adobe.com/en/topics/${topic}` : 'https://blog.adobe.com';

    return {
        title,
        link,
        description: `Adobe Blog${topic ? ` - ${topic.replaceAll('-', ' ')}` : ''}`,
        item: feedItems,
    };
}
