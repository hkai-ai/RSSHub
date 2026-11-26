import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.bio-itworld.com';
const NEWS_URL = `${BASE_URL}/news`;

export const parseBioItWorldNews = (html: string): DataItem[] => {
    const $ = load(html);
    const seen = new Set<string>();
    const items: DataItem[] = [];

    $('a[href*="/news/20"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href')?.trim();
        if (!href) {
            return;
        }
        const link = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        const dateMatch = link.match(/\/news\/(\d{4})\/(\d{2})\/(\d{2})\/[^/?#]+/);
        if (!dateMatch || seen.has(link)) {
            return;
        }
        const title = ($el.find('h1, h2, h3, h4').first().text() || $el.text() || $el.attr('title') || '').replaceAll(/\s+/g, ' ').trim();
        if (!title || title.length < 8 || /^(read more|more|continue reading)$/i.test(title)) {
            return;
        }
        seen.add(link);

        const container = $el.closest('article, li, .item, .card, .views-row, div');
        const summary = container.find('p, .summary, .excerpt, .description').first().text().replaceAll(/\s+/g, ' ').trim();
        const pubDate = parseDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);

        items.push({
            title,
            link,
            guid: link,
            description: summary || title,
            author: 'Bio-IT World',
            pubDate,
        });
    });

    return items.slice(0, 30);
};

export const route: Route = {
    path: '/news',
    name: 'News',
    categories: ['new-media'],
    example: '/bio-itworld/news',
    maintainers: ['claude'],
    description: 'Latest life sciences, biotech IT, and AI news from Bio-IT World.',
    url: 'www.bio-itworld.com/news',
    features: {
        requireConfig: [
            { name: 'BRIGHTDATA_API_KEY', description: 'Bright Data API key for bypassing anti-bot measures' },
            { name: 'BRIGHTDATA_UNLOCKER_ZONE', description: 'Bright Data zone identifier for web unlocker' },
        ],
    },
    radar: [{ source: ['www.bio-itworld.com/news'], target: '/news' }],
    handler: async () =>
        await cache.tryGet(
            NEWS_URL,
            async () => {
                const html = await unlockWebsite(NEWS_URL);
                const item = parseBioItWorldNews(html);
                if (!item.length) {
                    throw new Error('No articles found on Bio-IT World news page');
                }
                return {
                    title: 'Bio-IT World News',
                    link: NEWS_URL,
                    item,
                };
            },
            3600,
            false
        ),
};
