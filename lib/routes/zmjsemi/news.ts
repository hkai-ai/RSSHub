import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news/:page?',
    name: '新闻资讯',
    categories: ['programming'],
    example: '/zmjsemi/news',
    parameters: {
        page: '页码，默认为 1',
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
            source: ['www.zmjsemi.com/news', 'www.zmjsemi.com/news/:page'],
            target: '/news/:page',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const page = ctx.req.param('page') ?? '1';
        const baseUrl = 'https://www.zmjsemi.com';
        const url = `${baseUrl}/news?page=${page}`;

        const response = await ofetch(url);
        const $ = load(response);

        const items: DataItem[] = await Promise.all(
            $('.zz-ul .zz-li')
                .toArray()
                .map((element) => {
                    const $item = $(element);
                    const $link = $item.find('a.zz-a');
                    const link = baseUrl + $link.attr('href');
                    const title = $item.find('h3.zz-textb').text().trim();
                    const description = $item.find('.zz-text').text().trim();
                    const dateText = $item.find('.zz-date span.font20').text().trim();
                    const image = $item.find('.public-img img.zz-img1').attr('src');

                    // Parse date (format: 2025.12.29)
                    const pubDate = timezone(parseDate(dateText, 'YYYY.MM.DD'), 8);

                    return cache.tryGet(link, async () => {
                        try {
                            const articleResponse = await ofetch(link);
                            const $article = load(articleResponse);

                            // Extract full article content
                            const fullDescription = $article('.zz-content').html() || description;

                            return {
                                title,
                                link,
                                description: fullDescription,
                                pubDate,
                                image: image ? baseUrl + image : undefined,
                            };
                        } catch (error) {
                            logger.error(`Failed to fetch article ${link}:`, error);
                            return {
                                title,
                                link,
                                description,
                                pubDate,
                                image: image ? baseUrl + image : undefined,
                            };
                        }
                    });
                })
        );

        return {
            title: '真茂佳半导体 - 新闻资讯',
            link: url,
            item: items,
        } as Data;
    },
};
