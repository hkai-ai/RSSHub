import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const link = 'https://www.liquid.ai/news';

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a[href^="/blog/"]').toArray()) {
        const anchor = $(element);
        const card = anchor.find('time').length ? anchor : anchor.parent();
        const time = card.find('time[datetime]').first();
        const title = anchor.find('h2, h3').first().text() || anchor.text();
        const date = time.attr('datetime');
        const url = new URL(anchor.attr('href')!, link).href;
        if (!title || !date || items.has(url)) {
            continue;
        }
        const pubDate = parseDate(`${date} +0000`, 'YYYY-MM-DD ZZ');
        if (Number.isNaN(pubDate.getTime())) {
            continue;
        }
        const category = time.siblings('span').not('[aria-hidden]').first().text();
        const image = card.find('img').first().attr('src');
        items.set(url, {
            title,
            link: url,
            pubDate,
            category: category ? [category] : [],
            image: image ? new URL(image, link).href : undefined,
        });
    }
    if (!items.size) {
        throw new Error('No Liquid AI news articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async () => ({
    title: 'Liquid AI News',
    link,
    description: 'Find out the latest about Liquid AI.',
    language: 'en' as const,
    item: parsePosts(await ofetch(link)),
});

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/liquid/blog',
    maintainers: ['claude'],
    radar: [{ source: ['www.liquid.ai/news', 'www.liquid.ai/company/blog'], target: '/blog' }],
    handler,
    url: 'www.liquid.ai/news',
};
