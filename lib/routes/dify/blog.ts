import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const link = 'https://dify.ai/blog';

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a[href^="/blog/"]:has(time[datetime])').toArray()) {
        const card = $(element);
        const title = card.find('h2, h3').first().text();
        const url = new URL(card.attr('href')!, link).href;
        const time = card.find('time[datetime]').first();
        const pubDate = parseDate(time.attr('datetime')!);
        if (!title || Number.isNaN(pubDate.getTime()) || items.has(url)) {
            continue;
        }
        const category = card.find('span.uppercase').first().text();
        items.set(url, {
            title,
            link: url,
            pubDate,
            description: card.find('p').first().html() || undefined,
            author: time.parent().children('span').not('[aria-hidden]').last().text() || undefined,
            category: category ? [category] : [],
        });
    }
    if (!items.size) {
        throw new Error('No Dify blog articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async () => ({
    title: 'Dify Blog',
    link,
    item: parsePosts(await ofetch(link)),
});

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/dify/blog',
    radar: [{ source: ['dify.ai/blog', 'dify.ai/blog/*'], target: '/blog' }],
    name: 'Blog',
    maintainers: ['claude'],
    handler,
};
