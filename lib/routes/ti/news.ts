import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const rssUrl = 'https://investor.ti.com/rss/news-releases.xml';

export const parseTiNewsRss = (xml: string): DataItem[] => {
    const $ = load(xml, { xmlMode: true });
    return $('item')
        .toArray()
        .map((el) => {
            const $el = $(el);
            const title = $el.find('title').first().text().trim();
            const link = $el.find('link').first().text().trim();
            const description = $el.find('description').first().text().trim();
            const pubDateRaw = $el.find('pubDate').first().text().trim();
            const parsed = pubDateRaw ? parseDate(pubDateRaw) : undefined;
            const guid = $el.find('guid').first().text().trim() || link;
            return {
                title,
                link,
                description,
                pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
                guid,
            };
        })
        .filter((item) => Boolean(item.title && item.link));
};

export const route: Route = {
    path: '/news/:category?/:year?',
    name: 'News Releases',
    categories: ['programming'],
    example: '/ti/news',
    parameters: {
        category: 'News category, optional (legacy parameter kept for compatibility)',
        year: 'Year filter, optional',
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
            source: ['www.ti.com/about-ti/newsroom/news-releases.html', 'www.ti.com/en-us/about-ti/newsroom/news-releases'],
            target: '/news',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx): Promise<Data> => {
        const year = ctx.req.param('year');
        const xml = await ofetch<string>(rssUrl, { parseResponse: (txt) => txt });
        let items = parseTiNewsRss(xml);
        if (year && /^\d{4}$/.test(year)) {
            items = items.filter((item) => item.pubDate && String(new Date(item.pubDate).getUTCFullYear()) === year);
        }
        if (!items.length) {
            throw new Error('No news releases found in TI RSS feed');
        }
        return {
            title: 'Texas Instruments - News Releases',
            link: 'https://www.ti.com/en-us/about-ti/newsroom/news-releases',
            description: 'Latest news releases from Texas Instruments',
            language: 'en' as const,
            item: items,
        };
    },
};
