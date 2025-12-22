import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    name: '法大大新闻资讯',
    url: 'fadada.com',
    description: '法大大官方新闻资讯，获取最新的公司动态、产品更新和行业资讯。',
    categories: ['new-media', 'finance'],
    example: '/fadada/news',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['fadada.com/news'],
            target: '/fadada/news',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const url = 'https://www.fadada.com/company-news';

        try {
            const response = await ofetch(url);
            const $ = load(response);

            const items: Array<{
                title: string;
                link: string;
                description: string;
                pubDate: Date;
                image?: string;
            }> = [];

            // 解析新闻列表
            $('article').each((_, element) => {
                const $article = $(element);

                // 获取标题
                const title = $article.find('h2 span').text().trim();
                if (!title) {
                    return; // 跳过没有标题的文章
                }

                // 获取链接
                const relativeLink = $article.find('a').attr('href');
                if (!relativeLink) {
                    return; // 跳过没有链接的文章
                }
                const link = `https://www.fadada.com${relativeLink}`;

                // 获取描述
                const description = $article.find('p.text-custom-gray').text().trim();

                // 获取发布日期
                const timeElement = $article.find('time');
                const datetime = timeElement.attr('datetime');
                const pubDate = datetime ? timezone(parseDate(datetime), 8) : timezone(new Date(), 8);

                // 获取图片
                const image = $article.find('img').attr('src');

                items.push({
                    title,
                    link,
                    description,
                    pubDate,
                    image,
                });
            });

            if (items.length === 0) {
                logger.warn('No news items found on fadada.com/company-news');
            }

            return {
                title: '法大大新闻资讯',
                link: url,
                description: '法大大官方新闻资讯，获取最新的公司动态、产品更新和行业资讯。',
                language: 'zh-CN',
                item: items,
            };
        } catch (error) {
            logger.error('Failed to fetch fadada.com company news:', error);
            throw new Error('Failed to fetch news from fadada.com');
        }
    },
};
