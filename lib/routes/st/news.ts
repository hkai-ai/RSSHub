import type { Context } from 'hono';
import Parser from 'rss-parser';

import { config } from '@/config';
import type { Route } from '@/types';

// Custom parser for ST RSS feed with additional fields
const parser = new Parser({
    customFields: {
        item: ['contentImage', 'mainCategory', 'postType'],
    },
    headers: {
        'User-Agent': config.ua,
    },
});

// Category mapping for route parameters
const CATEGORY_MAP: Record<string, string> = {
    'product-technology': 'Products & technology',
    corporate: 'Corporate',
    feature: 'Feature',
};

export const route: Route = {
    path: '/news/:category?',
    name: 'News',
    categories: ['programming'],
    example: '/st/news/product-technology',
    parameters: {
        category: 'News category, can be `product-technology`, `corporate`, or `feature`. Default: all news',
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
            source: ['newsroom.st.com/all-news/product-technology'],
            target: '/news/product-technology',
        },
        {
            source: ['newsroom.st.com/all-news/corporate'],
            target: '/news/corporate',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx: Context) => {
        const category = ctx.req.param('category');
        const filterCategory = category ? CATEGORY_MAP[category] : undefined;

        // Fetch the main RSS feed
        const feedUrl = 'https://www.st.com/etc/st-search-cx/rss/en/press-rss.xml';
        const feed = await parser.parseURL(feedUrl);

        // Filter items by category if specified
        let items = feed.items;
        if (filterCategory) {
            items = feed.items.filter((item: any) => item.mainCategory === filterCategory);
        }

        // Map items to RSS format
        const processedItems = items.map((item: any) => ({
            title: item.title,
            link: item.link,
            description: item.contentSummary || item.description || item.content,
            pubDate: item.pubDate,
            category: item.mainCategory ? [item.mainCategory, item.postType].filter(Boolean) : undefined,
            // Include image if available
            ...(item.contentImage && { image: `https://newsroom.st.com${item.contentImage}` }),
        }));

        return {
            title: filterCategory ? `${feed.title} - ${filterCategory}` : feed.title,
            link: category ? `https://newsroom.st.com/all-news/${category}` : feed.link,
            description: filterCategory ? `${feed.description} - ${filterCategory}` : feed.description,
            language: feed.language,
            item: processedItems,
        };
    },
};
