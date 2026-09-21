import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const link = 'https://www.anthropic.com/research';

export const parseResearch = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a:has(time)').toArray()) {
        const anchor = $(element);
        const href = anchor.attr('href');
        if (!href) {
            continue;
        }
        const url = new URL(href, link);
        if (url.origin !== 'https://www.anthropic.com' || !/^\/(research|news)\/[^/]+$/.test(url.pathname)) {
            continue;
        }
        // Featured cards use headings; publication rows have a direct title span.
        const title = anchor.find('h2, h3, h4').first().text() || anchor.children('span').last().text();
        const date = anchor.find('time').first().text();
        if (!title || !date) {
            continue;
        }
        const pubDate = parseDate(`${date} +0000`, 'MMM D, YYYY ZZ');
        if (Number.isNaN(pubDate.getTime())) {
            continue;
        }
        if (!items.has(url.href)) {
            items.set(url.href, {
                title,
                link: url.href,
                pubDate,
                description: anchor.find('p').first().html() || undefined,
                category: anchor.find('div > span').first().text() ? [anchor.find('div > span').first().text()] : [],
            });
        }
    }
    if (!items.size) {
        throw new Error('No Anthropic research articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async () => ({
    title: 'Anthropic Research',
    link,
    description: 'Latest research from Anthropic',
    item: parseResearch(await ofetch(link)),
});

export const route: Route = {
    path: '/research',
    categories: ['programming'],
    example: '/anthropic/research',
    radar: [{ source: ['www.anthropic.com/research', 'www.anthropic.com'] }],
    name: 'Research',
    maintainers: ['ttttmr'],
    handler,
    url: 'www.anthropic.com/research',
};
