import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    name: 'Product News',
    categories: ['program-update'],
    example: '/tdk/news',
    radar: [
        {
            source: ['product.tdk.com/en/news/index.html'],
            target: '/news',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const url = 'https://product.tdk.com/en/news/index.html';

        const response = await ofetch(url);
        const $ = load(response);

        const items = $('.product-news-view.views-row')
            .toArray()
            .map((element) => {
                const $element = $(element);

                // Extract link
                const linkElement = $element.find('.title a');
                let link = linkElement.attr('href') || '';

                // Handle relative URLs
                if (link.startsWith('/')) {
                    link = `https://product.tdk.com${link}`;
                }

                // Extract title
                const title = linkElement.text().trim();

                // Extract date
                const dateText = $element.find('.date').text().trim();
                let pubDate: Date | undefined;
                try {
                    // Date format: "Jan. 7, 2026" or "Dec. 24, 2025"
                    pubDate = timezone(parseDate(dateText.replace('.', ''), 'MMM D, YYYY', 'en'), 0);
                } catch (error) {
                    logger.error(`Failed to parse date: ${dateText}`, error);
                }

                // Extract category
                const category = $element.find('.category table td').text().trim();

                // Extract image
                const imageElement = $element.find('.thumbnail img');
                let image = imageElement.attr('src') || '';

                // Handle relative image URLs
                if (image.startsWith('/')) {
                    image = `https://www.tdk.com${image}`;
                }

                return {
                    title,
                    link,
                    description: `<img src="${image}"><br>${title}`,
                    author: 'TDK',
                    category: category ? [category] : undefined,
                    pubDate,
                    image,
                };
            });

        return {
            title: 'TDK Product News',
            link: url,
            description: 'Latest product news and updates from TDK',
            language: 'en',
            item: items,
        };
    },
};
