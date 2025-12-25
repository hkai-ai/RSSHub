import type { Data, DataItem, Language, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/newsroom/:lang?/:year?',
    name: 'Newsroom',
    categories: ['traditional-media'],
    example: '/magna/newsroom/en/all',
    parameters: {
        lang: 'Language code, `en` or `de`, default is `en`',
        year: 'Year filter, `all` for all years or specific year like `2025`, default is `all`',
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
            source: ['www.magna.com/newsroom/news'],
            target: '/newsroom/en/all',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const lang = ctx.req.param('lang') || 'en';
        const year = ctx.req.param('year') || 'all';

        const apiUrl = `https://www.magna.com/magna-api/GetStories/${lang}/fc6304b1-a945-47bf-8445-b093dcf51ec5/all/${year}/?page=1&startlang=${lang}`;

        let data;
        try {
            data = await ofetch(apiUrl);
        } catch (error) {
            logger.error(`Failed to fetch MAGNA newsroom API: ${error}`);
            throw error;
        }

        const items: DataItem[] = data.StoryList.map((story) => {
            // Convert relative URL to absolute URL
            const absoluteUrl = story.Url.replace(/^~\//, 'https://www.magna.com/');

            // Parse the date (format: "November 21, 2025")
            const pubDate = timezone(parseDate(story.Date, 'MMMM DD, YYYY', 'en'), 0);

            return {
                title: story.Title,
                link: absoluteUrl,
                description: `<img src="${story.Image}"><br>${story.Type} - ${story.ReadTime}`,
                author: 'MAGNA',
                pubDate,
                category: [story.Type],
                guid: story.Id,
            };
        });

        const response: Data = {
            title: `MAGNA Newsroom - ${lang.toUpperCase()} - ${year}`,
            link: `https://www.magna.com/newsroom/news?year=${year}&lang=${lang}&page=1`,
            description: `MAGNA International newsroom updates in ${lang.toUpperCase()}`,
            language: lang as Language,
            item: items,
        };

        return response;
    },
};
