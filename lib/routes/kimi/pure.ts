import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export const parseKimiBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main .menu-card a[aria-label][href]').toArray()) {
        const anchor = $(element);
        const href = anchor.attr('href') || '';
        if (!/^\/(?:en\/)?blog\/[^/?#]+\/?$/.test(href)) {
            continue;
        }
        const link = new URL(href, 'https://www.kimi.com').href;
        const card = anchor.closest('.menu-card');
        const title = card.find('.card-title').text() || anchor.attr('aria-label');
        const dateText = card.find('.card-date').text();
        const date = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? parseDate(`${dateText}T00:00:00Z`) : undefined;
        if (!title) {
            continue;
        }
        items.set(link, { title, link, pubDate: date && !Number.isNaN(date.getTime()) ? date : undefined });
    }
    return [...items.values()];
};
