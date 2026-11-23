import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export const parsePoolsideBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a[href^="/blog/"]:has(article)').toArray()) {
        const anchor = $(element);
        const href = anchor.attr('href') || '';
        const title = anchor.find('h2, h3').first().text();
        if (!title || !/^\/blog\/[^/?#]+\/?$/.test(href)) {
            continue;
        }
        const link = new URL(href, 'https://poolside.ai').href;
        const dateText = anchor.find('time').attr('datetime');
        const date = dateText ? parseDate(`${dateText}T00:00:00Z`) : undefined;
        const item: DataItem = { title, link, description: anchor.find('article p').first().html() || undefined, pubDate: date && !Number.isNaN(date.getTime()) ? date : undefined };
        const previous = items.get(link);
        items.set(link, previous?.pubDate && !item.pubDate ? previous : item);
    }
    return [...items.values()];
};

export const parsePoolsideArticleDate = (html: string): Date | undefined => {
    const $ = load(html);
    const value = $('time[datetime]').first().attr('datetime');
    const date = value ? parseDate(`${value}T00:00:00Z`) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
};
