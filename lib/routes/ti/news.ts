import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

interface NewsItem {
    name: string;
    path: string;
    headline: string;
    subheadline: string;
    image: string;
    date: string;
    category: string;
}

export const route: Route = {
    path: '/news/:category?/:year?',
    name: 'News Releases',
    categories: ['programming'],
    example: '/ti/news',
    parameters: {
        category: 'News category, empty for all categories',
        year: 'Year filter, empty for all years',
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
            source: ['www.ti.com/about-ti/newsroom/news-releases.html'],
            target: '/news',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx: Context): Promise<Data> => {
        const category = ctx.req.param('category') || 'none';
        const year = ctx.req.param('year') || 'none';
        const page = '1';

        const apiUrl = `https://www.ti.com/bin/ti/newsroom?page=${page}&lang=en-us&categories=${category}&years=${year}&type=news`;
        const baseUrl = 'https://www.ti.com';

        const response = await ofetch<[string, ...NewsItem[]]>(apiUrl);

        // First element is the total count, skip it
        const newsItems = response.slice(1) as NewsItem[];

        const items: DataItem[] = newsItems.map((item) => {
            const link = item.path.startsWith('http') ? item.path : baseUrl + item.path;
            const pubDate = timezone(parseDate(item.date, 'DD MMM YYYY', 'en'), 0);
            let description = '';
            if (item.image) {
                const imageUrl = item.image.startsWith('http') ? item.image : baseUrl + item.image;
                description += `<img src="${imageUrl}" alt="${item.name}"><br>`;
            }
            description += item.subheadline;

            return {
                title: item.name,
                link,
                description,
                pubDate,
                category: [item.category],
            };
        });

        return {
            title: 'Texas Instruments - News Releases',
            link: 'https://www.ti.com/about-ti/newsroom/news-releases.html',
            description: 'Latest news releases from Texas Instruments',
            language: 'en' as const,
            item: items,
        };
    },
};
