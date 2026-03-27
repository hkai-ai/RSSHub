import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://multiversecomputing.com';

export const route: Route = {
    path: '/resources',
    name: 'Resources',
    categories: ['programming'],
    example: '/multiversecomputing/resources',
    maintainers: ['claude'],
    radar: [
        {
            source: ['multiversecomputing.com/resources'],
            target: '/multiversecomputing/resources',
        },
    ],
    handler,
    url: 'multiversecomputing.com/resources',
};

async function handler() {
    const response = await ofetch(`${baseUrl}/resources`);
    const $ = load(response);

    const list: DataItem[] = [];

    $('a[href^="/resources/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        if (!href || href === '/resources' || href === '/resources/') {
            return;
        }

        const title = $el.find('h3').text().trim();
        const dateText = $el.find('.text-gray-6').first().text().trim();
        const description = $el.find('p.line-clamp-5').text().trim();
        const image = $el.find('img').attr('src');

        if (!title) {
            return;
        }

        const link = new URL(href, baseUrl).href;

        // Avoid duplicates
        if (list.some((item) => item.link === link)) {
            return;
        }

        list.push({
            title,
            link,
            description,
            pubDate: dateText ? parseDate(dateText) : undefined,
            image,
        });
    });

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link as string, async () => {
                try {
                    const detailResponse = await ofetch(item.link as string);
                    const $detail = load(detailResponse);

                    const content = $detail('article').html();

                    return {
                        ...item,
                        description: content || item.description,
                    } as DataItem;
                } catch (error) {
                    logger.error(`Failed to fetch detail for "${item.title}":`, error);
                    return item;
                }
            })
        )
    );

    return {
        title: 'Multiverse Computing - Resources',
        link: `${baseUrl}/resources`,
        description: 'Latest news and resources from Multiverse Computing',
        language: 'en' as const,
        item: items as DataItem[],
    };
}
