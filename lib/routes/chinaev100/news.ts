import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    name: '新闻列表',
    categories: ['new-media'],
    example: '/chinaev100/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['chinaev100.com/news/list'],
            target: '/news',
        },
    ],
    handler: async () => {
        const url = 'https://www.chinaev100.com/news/list';
        const html = await ofetch(url);
        const $ = load(html);

        const items = $('.newfocusx_list ul li')
            .toArray()
            .map((item) => {
                const $item = $(item);
                const title = $item.find('.tit a').text().trim();
                const link = $item.find('.tit a').attr('href');
                const dateText = $item.find('.time .timefrist').text().trim();
                const description = $item.find('.desc').text().trim();

                return {
                    title,
                    link,
                    description: description || title,
                    pubDate: dateText ? timezone(parseDate(dateText, 'YYYY/MM/DD'), +8) : undefined,
                };
            });

        return {
            title: '车百会研究院 - 新闻',
            link: url,
            description: '中国电动汽车百人会研究院新闻',
            language: 'zh-CN',
            item: items,
        };
    },
};
