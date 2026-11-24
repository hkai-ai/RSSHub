import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const parseArticles = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a[href^="/hub/blog/"]').toArray()) {
        const card = $(element);
        const url = new URL(card.attr('href')!, 'https://www.perplexity.ai');
        if (!/^\/hub\/blog\/[^/]+$/.test(url.pathname) || items.has(url.href)) {
            continue;
        }
        const heading = card.find('.text-pretty').first();
        const title = heading.text();
        const datetime = card.find('time[datetime]').first().attr('datetime');
        const date =
            datetime ||
            heading
                .prev('span')
                .text()
                .match(/[A-Z][a-z]{2} \d{1,2}, \d{4}$/)?.[0];
        if (!title || !date) {
            continue;
        }
        const pubDate = datetime ? parseDate(`${datetime} +0000`, 'YYYY-MM-DD ZZ') : parseDate(`${date} +0000`, 'MMM D, YYYY ZZ');
        if (Number.isNaN(pubDate.getTime())) {
            continue;
        }
        items.set(url.href, {
            title,
            link: url.href,
            pubDate,
            description: heading.next('span').html() || card.find('p').first().html() || undefined,
            image: card.find('img').first().attr('src'),
        });
    }
    if (!items.size) {
        throw new Error('No Perplexity articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const fetchArticles = async (link: string): Promise<DataItem[]> => {
    try {
        return parseArticles(await ofetch(link, { retry: 0 }));
    } catch {
        // Some server networks receive a challenge even though the public page is accessible elsewhere.
        return parseArticles(await unlockWebsite(link));
    }
};
