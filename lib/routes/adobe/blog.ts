import { load } from 'cheerio';

import type { Route } from '@/types';
import got from '@/utils/got';

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

async function handler(ctx) {
    const { topic } = ctx.req.param();
    const limit = Number.parseInt(ctx.req.query('limit')) || 500;
    const offset = Number.parseInt(ctx.req.query('offset')) || 0;

    let topicTag = topic;

    // If topic is specified, get the actual tag from the topic page
    if (topic) {
        const topicUrl = `https://blog.adobe.com/en/topics/${topic}`;
        const topicResponse = await got(topicUrl);
        const $ = load(topicResponse.data);
        const h1Element = $(`h1#${topic}`);
        if (h1Element.length > 0) {
            topicTag = h1Element.text().trim();
        }
    }

    const apiUrl = 'https://blog.adobe.com/en/query-index.json';

    const response = await got(apiUrl, {
        searchParams: {
            limit,
            offset,
        },
    });

    let items = response.data.data || [];

    // Filter by topic tag if specified
    if (topicTag && topic) {
        items = items.filter((item) => {
            if (!item.tags) {
                return false;
            }
            try {
                const tags = JSON.parse(item.tags);
                return tags.includes(topicTag);
            } catch {
                return false;
            }
        });
    }

    // Transform the data
    const feedItems = items.map((item) => {
        // Convert Excel date serial number to JS Date
        let pubDate;
        if (item.date) {
            // Excel date serial number starts from 1900-01-01
            const daysOffset = Number.parseInt(item.date) - 1; // Subtract 1 because Excel counts from day 1, not day 0
            pubDate = new Date(daysOffset * 24 * 60 * 60 * 1000);
        }

        return {
            title: item.title || 'Untitled',
            link: `https://blog.adobe.com${item.path}`,
            description: item.description || '',
            pubDate: pubDate || undefined,
            author: item.author || '',
            category: item.category || [],
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
