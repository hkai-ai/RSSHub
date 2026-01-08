import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    categories: ['new-media'],
    example: '/unt-c/news',
    radar: [
        {
            source: ['cn.unt-c.com/html/news/'],
            target: '/news',
        },
    ],
    name: '公司新闻',
    maintainers: ['claude'],
    handler,
};

async function handler() {
    const baseUrl = 'https://cn.unt-c.com';
    const url = `${baseUrl}/html/news/`;

    const response = await ofetch(url);
    const $ = load(response);

    const items = $('.news_list .news_item')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const title = $item.find('.news_title a').text().trim();
            const link = $item.find('.news_title a').attr('href');
            const description = $item.find('.news_brief').text().trim();
            const dateText = $item.find('.news_status_time').text().trim();
            const image = $item.find('.imgbox.pic img').attr('src');

            // 解析日期 (格式: YYYY-MM-DD)
            const pubDate = timezone(parseDate(dateText, 'YYYY-MM-DD'), 8);

            return {
                title,
                link: link?.startsWith('http') ? link : `${baseUrl}${link}`,
                description: image ? `<img src="${baseUrl}${image}"><br>${description}` : description,
                pubDate,
            };
        });

    return {
        title: '芯联集成 - 公司新闻',
        link: url,
        item: items,
    };
}
