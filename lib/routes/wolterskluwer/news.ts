import type { Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';

import { parseWoltersKluwerListing } from './pure';

export const route: Route = {
    path: '/news/:types?',
    name: 'News',
    categories: ['journal'],
    example: '/wolterskluwer/news',
    features: {
        requireConfig: [
            { name: 'BRIGHTDATA_API_KEY', description: 'Bright Data API key for bypassing Cloudflare' },
            { name: 'BRIGHTDATA_UNLOCKER_ZONE', description: 'Bright Data web unlocker zone' },
        ],
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['wolterskluwer.com/en/news', 'wolterskluwer.com/'],
            target: '/news',
        },
    ],
    maintainers: ['claude-code'],
    handler: async (ctx) => {
        const { types = '' } = ctx.req.param();
        const url = 'https://www.wolterskluwer.com/en/news';
        const cacheKey = `wolterskluwer:news:v2:${types || 'all'}`;

        return await cache.tryGet(
            cacheKey,
            async () => {
                const html = await unlockWebsite(url);
                const items = parseWoltersKluwerListing(html, '/en/news/');
                if (!items.length) {
                    throw new Error('No news items found on Wolters Kluwer newsroom page');
                }
                return {
                    title: 'Wolters Kluwer News',
                    link: url,
                    description: 'Latest news from Wolters Kluwer.',
                    item: items,
                };
            },
            3600,
            false
        );
    },
};
