import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/neota/blog',
    parameters: {},
    radar: [
        {
            source: ['neota.com/blog/'],
        },
    ],
    name: 'Blog',
    maintainers: [],
    handler: async () => {
        const rootUrl = 'https://neota.com';
        const currentUrl = `${rootUrl}/blog/`;

        return await cache.tryGet(
            currentUrl,
            async () => {
                const response = await ofetch(currentUrl);
                const $ = load(response);

                const items = $('.bde-loop-item.ee-post')
                    .toArray()
                    .map((item) => {
                        const $item = $(item);
                        const titleEl = $item.find('.ee-post-title-link');
                        const title = titleEl.text().trim();
                        const link = titleEl.attr('href');
                        const description = $item.find('.ee-post-content').text().trim();
                        const pubDateText = $item.find('.ee-post-meta-date').text().trim();

                        const categories = $item
                            .find('.ee-post-taxonomy-item a')
                            .toArray()
                            .map((cat) => $(cat).text().trim());

                        // Skip items without valid date or description
                        if (!pubDateText || !description || !title || !link || pubDateText.length < 5) {
                            return null;
                        }

                        const parsedDate = parseDate(pubDateText);
                        if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.getFullYear() < 2000) {
                            return null;
                        }

                        return {
                            title,
                            link,
                            description,
                            pubDate: parsedDate,
                            category: categories,
                        };
                    })
                    .filter((item) => item !== null);

                return {
                    title: 'Neota - Blog',
                    link: currentUrl,
                    item: items,
                    description: 'Neota blog posts',
                };
            },
            3600,
            false
        );
    },
};
