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

async function handler(ctx) {
    const { topic } = ctx.req.param();
    const limit = Number.parseInt(ctx.req.query('limit')) || 500;
    const offset = Number.parseInt(ctx.req.query('offset')) || 0;

    // Convert topic slug to title case for tag matching
    // e.g., "adobe-firefly" → "Adobe Firefly"
    const topicTag = topic
        ? topic
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
        : undefined;

    const apiUrl = 'https://blog.adobe.com/en/query-index.json';

    const response = await ofetch(apiUrl, {
        query: {
            limit,
            offset,
        },
    });

    let items: Array<{ date?: string; title?: string; path?: string; description?: string; author?: string; tags?: string; image?: string }> = response.data || [];

    // Filter by topic tag if specified
    if (topicTag) {
        items = items.filter((item) => {
            if (!item.tags) {
                return false;
            }
            try {
                const tags: string[] = JSON.parse(item.tags);
                return tags.some((tag) => tag.toLowerCase() === topicTag.toLowerCase());
            } catch {
                return false;
            }
        });
    }

    // Transform the data
    const feedItems = items.map((item) => {
        let pubDate: Date | undefined;
        if (item.date) {
            const serial = Number.parseInt(item.date);
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
    });

    const title = topic ? `Adobe Blog - ${topic.replaceAll('-', ' ')}` : 'Adobe Blog';
    const link = topic ? `https://blog.adobe.com/en/topics/${topic}` : 'https://blog.adobe.com';

    return {
        title,
        link,
        description: `Adobe Blog${topic ? ` - ${topic.replaceAll('-', ' ')}` : ''}`,
        item: feedItems,
    };
}
