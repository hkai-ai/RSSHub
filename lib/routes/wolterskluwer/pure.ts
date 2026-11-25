import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.wolterskluwer.com';

export const parseWoltersKluwerListing = (html: string, pathPrefix: '/en/news/' | '/en/expert-insights/'): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $(`a[href*="${pathPrefix}"]`).each((_, el) => {
        const $a = $(el);
        const rawHref = $a.attr('href')?.trim();
        if (!rawHref) {
            return;
        }
        const normalizedUrl = new URL(rawHref, baseUrl);
        normalizedUrl.hash = '';
        normalizedUrl.search = '';
        const pathname = normalizedUrl.pathname.replace(/\/+$/, '');
        const trimmedPrefix = pathPrefix.replace(/\/+$/, '');
        if (!pathname.startsWith(`${trimmedPrefix}/`) || pathname === trimmedPrefix) {
            return;
        }
        const link = normalizedUrl.href;
        if (seen.has(link)) {
            return;
        }
        const title = ($a.find('h1, h2, h3, h4, h5').first().text() || $a.text()).replaceAll(/\s+/g, ' ').trim();
        if (!title || title.length < 10) {
            return;
        }
        seen.add(link);

        const $card = $a.closest('article, li, [class*="card"], [class*="item"], [class*="tile"]');
        const description =
            $card
                .find('p')
                .toArray()
                .map((p) => $(p).text().replaceAll(/\s+/g, ' ').trim())
                .find((txt) => txt.length > 15 && txt !== title) || '';
        const timeAttr = $card.find('time').first().attr('datetime') || $card.find('time').first().text().trim();
        const parsed = timeAttr ? parseDate(timeAttr) : undefined;

        items.push({
            title,
            link,
            description,
            pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
            guid: link,
        });
    });

    return items;
};
