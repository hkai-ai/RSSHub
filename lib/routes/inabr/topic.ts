import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/topic/:topic?',
    name: '专题文章',
    categories: ['traditional-media'],
    example: '/inabr/topic/new_energy',
    parameters: {
        topic: '专题名称，可在URL中找到，默认为 new_energy',
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
            source: ['inabr.com/topic/:topic'],
            target: '/topic/:topic',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const topic = ctx.req.param('topic') ?? 'new_energy';
        const url = `https://inabr.com/topic/${topic}`;

        const html = await ofetch(url);
        const $ = load(html);

        const items = $('ul.pageList.article_list li.articleItem')
            .toArray()
            .map((item) => {
                const $item = $(item);
                const $link = $item.find('a');
                const $con = $item.find('.articleItem_con');
                const $cur = $item.find('.articleItem_cur');

                const link = $link.attr('href');
                const title = $con.find('h5').text().trim();
                const description = $con.find('p').text().trim();
                const image = $item.find('img').attr('src');

                // Extract author from "作者 | 来源" format
                const authorText = $cur.find('p').first().text().trim();
                const author = authorText.split('|')[0]?.trim() || '汽车商业评论';

                // Parse date "2025-06-11 17:50"
                const dateText = $cur.find('p').last().text().trim();
                const pubDate = timezone(parseDate(dateText, 'YYYY-MM-DD HH:mm'), +8);

                return {
                    title,
                    link: `https://inabr.com${link}`,
                    description: `${image ? `<img src="${image}">` : ''}<p>${description}</p>`,
                    author,
                    pubDate,
                };
            });

        return {
            title: `汽车商业评论 - ${topic}`,
            link: url,
            description: `汽车商业评论${topic}专题文章`,
            language: 'zh-CN',
            item: items,
        };
    },
};
