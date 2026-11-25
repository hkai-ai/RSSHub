import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const rssUrl = 'https://ir.navitassemi.com/rss/news-releases.xml';

export const parseNavitasNewsRss = (xml: string): DataItem[] => {
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
    path: '/news',
    name: '新闻中心',
    categories: ['programming'],
    example: '/navitassemi/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['navitassemi.com/zh/news-zh/', 'ir.navitassemi.com/'],
            target: '/news',
        },
    ],
    handler: async () => {
        const xml = await ofetch<string>(rssUrl, { parseResponse: (txt) => txt });
        const items = parseNavitasNewsRss(xml);
        if (!items.length) {
            throw new Error('No news releases found in Navitas Semiconductor RSS feed');
        }
        return {
            title: 'Navitas Semiconductor - 新闻中心',
            link: 'https://navitassemi.com/zh/news-zh/',
            description: 'Navitas Semiconductor 新闻与公告',
            language: 'en',
            item: items,
        };
    },
};
