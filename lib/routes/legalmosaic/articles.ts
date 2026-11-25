import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.legalmosaic.com';

export const parseLegalMosaicArticles = (html: string): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $('article.article-card').each((_, el) => {
        const $card = $(el);
        const $titleLink = $card.find('h3 a, h2 a').first();
        const href = $titleLink.attr('href')?.trim();
        const title = $titleLink.text().replaceAll(/\s+/g, ' ').trim();
        if (!href || !title) {
            return;
        }
        const link = new URL(href, baseUrl).href;
        if (seen.has(link)) {
            return;
        }
        seen.add(link);

        const dateText = $card.find('time').first().text().trim();
        const parsed = dateText ? parseDate(dateText) : undefined;
        const description = $card.find('p').first().text().replaceAll(/\s+/g, ' ').trim();

        items.push({
            title,
            link,
            description,
            pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
            author: 'Mark A. Cohen',
            guid: link,
        });
    });

    return items;
};

export const route: Route = {
    path: '/articles',
    name: 'Articles',
    categories: ['journal'],
    example: '/legalmosaic/articles',
    maintainers: ['claude'],
    url: 'www.legalmosaic.com/forbes/',
    radar: [
        {
            source: ['www.legalmosaic.com/forbes/', 'www.legalmosaic.com/'],
            target: '/articles',
        },
    ],
    handler: async () => {
        const link = `${baseUrl}/forbes/`;
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseLegalMosaicArticles(html);
        if (!item.length) {
            throw new Error('No articles found on Legal Mosaic');
        }
        return {
            title: 'Legal Mosaic — Mark A. Cohen',
            link,
            description: 'Representative essays and free reprints from Legal Mosaic.',
            language: 'en',
            item,
        };
    },
};
