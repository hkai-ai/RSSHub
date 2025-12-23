import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    name: '企业新闻',
    categories: ['other'],
    example: '/vmaxpower/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['www.vmaxpower.com.cn/news.php'],
            target: '/news',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://www.vmaxpower.com.cn';
        const url = `${baseUrl}/news.php?class_id=104101`;

        const response = await ofetch(url);
        const $ = load(response);

        const items: DataItem[] = $('.news_list .item')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const title = $item.find('.tit h3 a').text().trim();
                const relativeLink = $item.find('.tit h3 a').attr('href') || '';
                const link = `${baseUrl}/${relativeLink}`;
                const dateText = $item.find('.time').text().trim();
                const imageUrl = $item.find('.pic img').attr('src') || '';
                const image = imageUrl.startsWith('../') ? `${baseUrl}/${imageUrl.slice(3)}` : imageUrl;

                const pubDate = timezone(parseDate(dateText, 'YYYY-MM-DD'), 8);

                return {
                    title,
                    link,
                    description: `<img src="${image}">`,
                    pubDate,
                };
            });

        const data: Data = {
            title: '威迈斯 - 企业新闻',
            link: url,
            item: items,
            language: 'zh-CN',
        };

        return data;
    },
};
