import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export const parseArticleList = (html: string, section: 'news' | 'research' | 'engineering'): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main time').toArray()) {
        const time = $(element);
        let container = time.parent();
        for (let depth = 0; depth < 6 && container.length; depth++, container = container.parent()) {
            // A date belongs to one card, never to a surrounding list of cards.
            if (container.find('time').length > 1) {
                break;
            }
            const anchor = container.is('a') ? container : container.find('a:has(h2, h3, h4), h2 a, h3 a, h4 a').first();
            const href = anchor.attr('href');
            if (!href) {
                if (container.is('article')) {
                    break;
                }
                continue;
            }
            const url = new URL(href, 'https://www.anthropic.com');
            if (url.origin !== 'https://www.anthropic.com' || url.pathname.includes('/team/')) {
                continue;
            }
            const title = anchor.find('h2, h3, h4').first().text() || (anchor.parent().is('h2, h3, h4') ? anchor.text() : anchor.children('span').last().text());
            const date = time.attr('datetime') || time.text();
            if (!title || !date) {
                continue;
            }
            const pubDate = time.attr('datetime') ? parseDate(date) : parseDate(`${date} +0000`, 'MMM D, YYYY ZZ');
            if (Number.isNaN(pubDate.getTime())) {
                continue;
            }
            if (!items.has(url.href)) {
                const category = container.find('header p, [class*="_category"]').first().text();
                items.set(url.href, {
                    title,
                    link: url.href,
                    pubDate,
                    description: container.find('p').not('header p').first().html() || undefined,
                    category: category ? [category] : [],
                    image: container.find('img').first().attr('src'),
                });
            }
            break;
        }
    }
    if (!items.size) {
        throw new Error(`No Anthropic ${section} articles found`);
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};
