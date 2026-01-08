import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    name: '公司新闻',
    categories: ['traditional-media'],
    example: '/novosns/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['novosns.com/company-news'],
            target: '/news',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://www.novosns.com';
        const url = `${baseUrl}/company-news`;

        const html = await ofetch(url);
        const $ = load(html);

        const items = $('.am_d2_fr2item')
            .toArray()
            .map((element) => {
                const $element = $(element);
                const link = $element.find('a').attr('href');
                const title = $element.find('h3').text().trim();
                const image = $element.find('.am_d2_fr2itemlimg1').attr('src');

                // Parse date: combines "12/08" and "2025" into "2025/12/08"
                const dateMonth = $element.find('.am_d2_fr2itemrl h2').text().trim();
                const dateYear = $element.find('.am_d2_fr2itemrl .g_word5').text().trim();
                const dateString = `${dateYear}/${dateMonth}`;
                const pubDate = timezone(parseDate(dateString, 'YYYY/MM/DD'), 8);

                return {
                    title,
                    link: `${baseUrl}${link}`,
                    pubDate,
                    image: image ? `${baseUrl}${image}` : undefined,
                };
            });

        // Fetch full content for each item
        const itemsWithContent = await Promise.all(
            items.map((item) =>
                cache.tryGet(item.link, async () => {
                    const detailHtml = await ofetch(item.link);
                    const $detail = load(detailHtml);

                    // Extract main content from article page
                    const description = $detail('.am_d3_content').html()?.trim() || '';

                    return {
                        ...item,
                        description,
                    };
                })
            )
        );

        return {
            title: '纳芯微电子 - 公司新闻',
            link: url,
            description: '纳芯微电子公司新闻与活动',
            item: itemsWithContent,
            language: 'zh-CN',
        };
    },
};
