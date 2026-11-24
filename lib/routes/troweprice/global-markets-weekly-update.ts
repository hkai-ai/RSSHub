import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const baseUrl = 'https://www.troweprice.com/personal-investing/resources/insights/global-markets-weekly-update.html';

export const parseWeeklyUpdate = (html: string) => {
    const $ = load(html);

    let parsedDate: Date | undefined;
    let headline = '';

    // 1. Prefer structured JSON-LD Article metadata (datePublished: "YYYY-MM-DD")
    $('script').each((_, el) => {
        if (parsedDate) {
            return;
        }
        const raw = $(el).text().trim();
        if (!raw.includes('datePublished')) {
            return;
        }
        try {
            const json = JSON.parse(raw);
            const entries = Array.isArray(json) ? json : [json];
            for (const entry of entries) {
                if (typeof entry?.datePublished === 'string') {
                    const dt = parseDate(entry.datePublished);
                    if (!Number.isNaN(dt.getTime())) {
                        parsedDate = dt;
                        if (typeof entry.headline === 'string') {
                            headline = entry.headline.trim();
                        }
                        return;
                    }
                }
            }
        } catch {
            // Fallback regex for non-strict JSON-LD blocks
            const m = raw.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
            if (m) {
                const dt = parseDate(m[1]);
                if (!Number.isNaN(dt.getTime())) {
                    parsedDate = dt;
                }
            }
        }
    });

    // 2. Legacy paragraph date fallback ("markets & economy | September 19, 2025")
    if (!parsedDate) {
        const dateElement = $('.paragraph-contents p:contains("markets & economy")').first();
        const dateText = dateElement.text().trim();
        const dateMatch = dateText.match(/\|\s*([a-zA-Z]+)\s+(\d{1,2}),\s*(\d{4})/);
        if (dateMatch) {
            const [, month, day, year] = dateMatch;
            const dt = parseDate(`${month} ${day}, ${year} 8:00 AM`);
            if (!Number.isNaN(dt.getTime())) {
                parsedDate = dt;
            }
        }
    }

    if (!parsedDate) {
        logger.error('Date element not found on page');
        throw new Error('Date element not found on page');
    }

    const pubDate = timezone(parsedDate, -5); // EST timezone (UTC-5)
    const monthNum = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    const dayNum = String(parsedDate.getUTCDate()).padStart(2, '0');
    const yearNum = parsedDate.getUTCFullYear();
    const dateParam = `${yearNum}-${monthNum}-${dayNum}`;
    const articleUrl = `${baseUrl}?date=${dateParam}`;

    const title = ($('h1.trp-darkest-gray.text-light').first().text().trim() || $('h1').first().text().trim() || headline || 'Global Markets Weekly Update').trim();
    const subtitle = ($('h2.trp-darkest-gray.text-light').first().text().trim() || $('h2').first().text().trim()).trim();
    const itemTitle = subtitle && subtitle.length > 10 ? `${title}: ${subtitle}` : `${title} (${dateParam})`;

    return {
        title,
        link: baseUrl,
        description: 'Weekly updates on global market conditions and economic developments from T. Rowe Price',
        item: [
            {
                title: itemTitle,
                link: articleUrl,
                pubDate,
            },
        ],
    };
};

export const route: Route = {
    path: '/global-markets-weekly-update',
    name: 'Global Markets Weekly Update',
    categories: ['finance', 'new-media'],
    example: '/troweprice/global-markets-weekly-update',
    maintainers: ['DIYgod'],
    handler: async () => {
        const response = await ofetch(baseUrl);
        return parseWeeklyUpdate(response);
    },
};
