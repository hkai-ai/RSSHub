import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/blog',
    name: '产品动态',
    url: 'qiyuesuo.com/us/detail/blogLog',
    description: '契约锁产品动态和更新公告',
    categories: ['finance'],
    maintainers: ['claude'],
    handler: async () => {
        try {
            const baseUrl = 'https://www.qiyuesuo.com';
            const url = `${baseUrl}/us/detail/blogLog`;

            logger.info(`Fetching 契约锁产品动态 from: ${url}`);

            const response = await ofetch(url);
            const $ = load(response);

            const items: Array<{
                title: string;
                link: string;
                description: string;
                pubDate: Date;
                image?: string;
            }> = [];

            // Parse blog list items
            $('.blog-list > li').each((_, element) => {
                const $item = $(element);
                const $link = $item.find('a.nuxt-link');
                const $content = $item.find('.content');

                // Extract title
                const title = $content.find('.title.ellipsis').text().trim();

                // Extract description
                const description = $content.find('.text').text().trim();

                // Extract link
                const relativeLink = $link.attr('href');
                const link = relativeLink ? `${baseUrl}${relativeLink}` : '';

                // Extract date from right-text
                const dateText = $content.find('.right-text').text().trim();
                // Extract date part (YYYY-MM-DD HH:mm:ss format)
                const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
                let pubDate = new Date();

                if (dateMatch) {
                    try {
                        // Parse date and apply Beijing timezone (+8)
                        pubDate = timezone(parseDate(dateMatch[1]), 8);
                    } catch (error) {
                        logger.error(`Failed to parse date "${dateMatch[1]}":`, error);
                    }
                }

                // Extract image from background-image style
                let image: string | undefined;
                const $imageDiv = $item.find('.image');
                const bgStyle = $imageDiv.attr('style');
                if (bgStyle) {
                    const imageMatch = bgStyle.match(/background-image:url\(([^)]+)\)/);
                    if (imageMatch) {
                        image = imageMatch[1];
                    }
                }

                if (title && link) {
                    items.push({
                        title,
                        link,
                        description,
                        pubDate,
                        image,
                    });
                }
            });

            logger.info(`Found ${items.length} blog items`);

            return {
                title: '契约锁产品动态',
                link: url,
                description: '契约锁电子合同和智能印章平台产品动态和更新公告',
                language: 'zh-CN' as const,
                item: items,
            };
        } catch (error) {
            logger.error('Error fetching 契约锁产品动态:', error);
            throw new Error('Failed to fetch 契约锁产品动态');
        }
    },
};
