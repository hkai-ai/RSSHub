import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/zyphra/blog',
    maintainers: ['claude'],
    handler,
    url: 'www.zyphra.com/blog',
    radar: [
        {
            source: ['www.zyphra.com/blog', 'www.zyphra.com/post/*'],
            target: '/zyphra/blog',
        },
    ],
};

async function handler() {
    const baseUrl = 'https://www.zyphra.com';
    const response = await ofetch(`${baseUrl}/blog`, { parseResponse: (txt) => txt });
    const $ = load(response);

    const items: DataItem[] = $('.collection-item.w-dyn-item')
        .toArray()
        .map((el) => {
            const item = $(el);
            const a = item.find('a').first();
            const link = new URL(a.attr('href') || '', baseUrl).href;
            const title = item.find('.heading-main').first().text().trim();
            const description = item.find('.paragraph-main').first().text().trim();
            const dateText = item.find('.text-blog-feature-main').first().text().trim();
            const category = item.find('.topic-main').first().text().trim();
            const author = item.find('.text-blog-feature').first().text().trim();
            const image = item.find('img').first().attr('src');

            return {
                title,
                link,
                description,
                pubDate: dateText ? parseDate(dateText) : undefined,
                category: category ? [category] : undefined,
                author: author || undefined,
                image,
            };
        })
        .filter((item) => item.title);

    const itemsWithContent = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const resp = await ofetch(item.link as string, { parseResponse: (txt) => txt });
                const $detail = load(resp);
                const content = $detail('.rich-text-block').first().html() || $detail('.w-richtext').first().html();
                if (content) {
                    return { ...item, description: content };
                }
                return item;
            })
        )
    );

    return {
        title: 'Zyphra Blog',
        link: `${baseUrl}/blog`,
        description: 'Latest posts from Zyphra',
        language: 'en' as const,
        item: itemsWithContent as DataItem[],
    };
}
