import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/press-releases/:category?/:region?/:year?',
    name: 'Press Releases',
    categories: ['traditional-media'],
    example: '/borgwarner/press-releases',
    parameters: {
        category: {
            description: 'Category filter',
            options: [
                { value: 'all', label: 'All' },
                { value: 'Aftermarket', label: 'Aftermarket' },
                { value: 'Company', label: 'Company' },
                { value: 'Financial Releases', label: 'Financial Releases' },
                { value: 'Products', label: 'Products' },
            ],
            default: 'all',
        },
        region: {
            description: 'Region filter',
            options: [
                { value: 'all', label: 'All' },
                { value: 'asia', label: 'Asia' },
                { value: 'europe', label: 'Europe' },
                { value: 'north america', label: 'North America' },
                { value: 'south america', label: 'South America' },
            ],
            default: 'all',
        },
        year: {
            description: 'Year filter',
            default: 'all',
        },
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
            source: ['www.borgwarner.com/newsroom/press-releases'],
            target: '/press-releases',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const category = ctx.req.param('category') || 'all';
        const region = ctx.req.param('region') || 'all';
        const year = ctx.req.param('year') || 'all';

        const url = `https://www.borgwarner.com/newsroom/press-releases/Page/1/${category}/${region}/${year}/all/all/all`;

        const html = await ofetch(url);
        const $ = load(html);

        const items = $('.row.widget-row')
            .filter((_, element) => {
                const $element = $(element);
                return $element.find('h2.bw-global-list-h3').length > 0;
            })
            .toArray()
            .map((element) => {
                const $element = $(element);

                const $title = $element.find('h2.bw-global-list-h3 a');
                const title = $title.text().trim();
                const link = new URL($title.attr('href') || '', 'https://www.borgwarner.com').href;

                const dateText = $element.find('div.h5.margin-bottom-0').text().trim();
                const pubDate = timezone(parseDate(dateText, 'MMM DD, YYYY', 'en'), 0);

                const description = $element.find('p.bw-global-list-p').text().trim();

                const $img = $element.find('img.aspectRatio');
                const imgSrc = $img.attr('src');
                const image = imgSrc ? new URL(imgSrc, 'https://www.borgwarner.com').href : undefined;

                return {
                    title,
                    link,
                    description,
                    pubDate,
                    image,
                };
            });

        return {
            title: 'BorgWarner Press Releases',
            link: 'https://www.borgwarner.com/newsroom/press-releases',
            description: 'Latest press releases from BorgWarner',
            item: items,
            language: 'en',
        };
    },
};
