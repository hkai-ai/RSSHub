import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/autonews/:section?',
    name: '汽车新闻',
    categories: ['new-media'],
    example: '/gasgoo/autonews/china_news',
    parameters: {
        section: '板块名称，默认为 china_news，可在 URL 中找到，如 china_news、europe_news 等',
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
            source: ['autonews.gasgoo.com/:section'],
            target: '/autonews/:section',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const section = ctx.req.param('section') || 'china_news';
        const url = `https://autonews.gasgoo.com/${section}`;

        const html = await ofetch(url);
        const $ = load(html);

        const items = $('.newsListShow ul li')
            .toArray()
            .map((element) => {
                const $element = $(element);
                const $link = $element.find('a').first();
                const $dd = $link.find('dd');

                const link = $link.attr('href') || '';
                const title = $dd.find('b').text().trim();
                const description = $dd.find('p').first().text().trim();
                const dateText = $dd.find('span p').text().trim();
                const image = $link.find('dt img').attr('src') || '';

                // Parse date: "Dec. 19 , 2025" format
                // Remove the extra spaces and parse
                const cleanDate = dateText
                    .replace(/^([A-Za-z]{3})\./, '$1') // "Dec." -> "Dec"
                    .replaceAll(/\s*,\s*/g, ', ') // "  ,  " -> ", "
                    .replaceAll(/\s+/g, ' ') // 多空格压成一个
                    .trim();
                const pubDate = timezone(parseDate(cleanDate, 'MMM D, YYYY', 'en'), 8);

                return {
                    title,
                    link,
                    description,
                    pubDate,
                    image,
                };
            });

        // Extract section title from page
        const pageTitle = $('title').text().trim() || `Gasgoo Automotive News - ${section}`;

        return {
            title: pageTitle,
            link: url,
            item: items,
            description: `Gasgoo automotive news - ${section} section`,
            language: 'en',
            image: 'https://autonews.gasgoo.com/favicon.ico',
        };
    },
};
