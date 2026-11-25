import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://pixverse.ai';
const BLOG_URL = `${BASE_URL}/en/blog`;

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'programming'],
    example: '/pixverse/blog',
    maintainers: ['claude'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['pixverse.ai/en/blog', 'pixverse.ai/en/blog/*'],
            target: '/blog',
        },
    ],
    url: 'pixverse.ai/en/blog',
    handler: async (): Promise<Data> => {
        const html = await ofetch<string>(BLOG_URL, { parseResponse: (txt) => txt });
        const $ = load(html);

        const seen = new Set<string>();
        const items: DataItem[] = $('article')
            .toArray()
            .map((el): DataItem | null => {
                const $el = $(el);
                const href = $el.find('a[href^="/en/blog/"]').first().attr('href')?.trim() ?? '';
                if (!href) {
                    return null;
                }

                const link = new URL(href, BASE_URL).href;
                if (seen.has(link)) {
                    return null;
                }

                const title = $el.find('h2, h3').first().text().replaceAll(/\s+/g, ' ').trim();
                if (!title) {
                    return null;
                }

                const summary = $el.find('p').first().text().replaceAll(/\s+/g, ' ').trim();
                const dateAttr = $el.find('time').first().attr('datetime')?.trim();
                const dateText = $el.find('time').first().text().trim();
                const parsedDate = dateAttr || dateText ? parseDate(dateAttr || dateText) : undefined;
                const pubDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

                const category = $el
                    .find('span')
                    .toArray()
                    .map((s) => $(s).text().trim())
                    .filter((t) => t.length > 0 && t.length <= 32);
                const image = $el.find('img').first().attr('src')?.trim() || undefined;

                seen.add(link);
                return {
                    title,
                    link,
                    description: summary || title,
                    pubDate,
                    category: category.length > 0 ? [category[0]] : undefined,
                    image,
                };
            })
            .filter((item): item is DataItem => item !== null);

        if (items.length === 0) {
            throw new Error('No articles found on PixVerse Blog');
        }

        return {
            title: 'PixVerse Blog',
            link: BLOG_URL,
            description: 'AI video tutorials, creator insights, and PixVerse updates',
            language: 'en' as const,
            item: items,
        };
    },
};
