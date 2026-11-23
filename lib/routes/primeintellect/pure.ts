import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export const parsePrimeIntellectBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a[href^="/blog/"]').toArray()) {
        const anchor = $(element);
        const title = anchor.find('.rf-strip-title, .rf-card-title, h2, h3').first().text();
        const href = anchor.attr('href') || '';
        if (!title || !/^\/blog\/[^/?#]+\/?$/.test(href)) {
            continue;
        }
        const link = new URL(href, 'https://www.primeintellect.ai').href;
        const dateText = anchor.find('.rf-strip-date, .rf-card-date, time').first().text().split('/')[0];
        const date = dateText ? parseDate(`${dateText} UTC`) : undefined;
        items.set(link, { title, link, pubDate: date && !Number.isNaN(date.getTime()) ? date : undefined });
    }
    return [...items.values()];
};
