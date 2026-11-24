import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const link = 'https://bolt.new/blog';

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('a.blog-hero-content, a.blog-list-item').toArray()) {
        const card = $(element);
        const href = card.attr('href');
        const title = card.find('.blog-hero-title, .blog-list-title').first().text();
        const date = card.find('.blog-hero-date, .blog-list-date').first().text();
        if (!href || !title || !date) {
            continue;
        }
        const url = new URL(href, link).href;
        const pubDate = parseDate(`${date} +0000`, 'MMM D, YYYY ZZ');
        if (Number.isNaN(pubDate.getTime()) || items.has(url)) {
            continue;
        }
        const category = card.find('.blog-hero-tag, .blog-list-tag').first().text();
        items.set(url, {
            title,
            link: url,
            pubDate,
            description: card.find('.blog-hero-excerpt, .blog-list-excerpt').first().html() || undefined,
            author: card.find('.blog-hero-author, .blog-list-author-name').first().text() || undefined,
            category: category ? [category] : [],
        });
    }
    if (!items.size) {
        throw new Error('No Bolt blog articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async () => ({
    title: 'Bolt Blog',
    link,
    item: parsePosts(await ofetch(link)),
});

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/bolt/blog',
    radar: [{ source: ['bolt.new/blog', 'bolt.new/blog/*'], target: '/blog' }],
    name: 'Blog',
    maintainers: ['claude'],
    handler,
};
