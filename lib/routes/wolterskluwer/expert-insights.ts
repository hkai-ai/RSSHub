import type { Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';

import { parseWoltersKluwerListing } from './pure';

export const route: Route = {
    path: '/expert-insights/:types?',
    name: 'Expert Insights',
    categories: ['journal'],
    example: '/wolterskluwer/expert-insights',
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
            source: ['wolterskluwer.com/en/expert-insights', 'wolterskluwer.com/'],
            target: '/expert-insights',
        },
    ],
    maintainers: ['claude-code'],
    handler: async (ctx) => {
        const { types = '' } = ctx.req.param();
        const url = 'https://www.wolterskluwer.com/en/expert-insights';
        const cacheKey = `wolterskluwer:expert-insights:v2:${types || 'all'}`;

        return await cache.tryGet(
            cacheKey,
            async () => {
                const html = await unlockWebsite(url);
                const items = parseWoltersKluwerListing(html, '/en/expert-insights/');
                if (!items.length) {
                    throw new Error('No expert insights found on Wolters Kluwer page');
                }
                return {
                    title: 'Wolters Kluwer Expert Insights',
                    link: url,
                    description: 'Latest expert insights from Wolters Kluwer.',
                    item: items,
                };
            },
            3600,
            false
        );
    },
};
