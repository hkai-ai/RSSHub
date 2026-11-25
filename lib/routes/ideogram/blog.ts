import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://ideogram.ai';
const BLOG_URL = `${BASE_URL}/blog/`;

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'picture'],
    example: '/ideogram/blog',
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
            source: ['ideogram.ai/blog', 'ideogram.ai/blog/*'],
            target: '/blog',
        },
    ],
    url: 'ideogram.ai/blog/',
    handler: async (): Promise<Data> => {
        const html = await ofetch<string>(BLOG_URL, { parseResponse: (txt) => txt });
        const $ = load(html);

        const seen = new Set<string>();
        const items: DataItem[] = $('a.blog-card[href]')
            .toArray()
            .map((el): DataItem | null => {
                const $el = $(el);
                const href = $el.attr('href')?.trim() ?? '';
                if (!href) {
                    return null;
                }

                const link = new URL(href, BASE_URL).href;
                if (seen.has(link)) {
                    return null;
                }

                const title = $el.find('.blog-card-title, h3, h2').first().text().replaceAll(/\s+/g, ' ').trim();
                if (!title) {
                    return null;
                }

                const excerpt = $el.find('.blog-card-excerpt, p').first().text().replaceAll(/\s+/g, ' ').trim();
                const dateAttr = $el.find('time').first().attr('datetime')?.trim();
                const dateText = $el.find('time').first().text().trim();
                const parsedDate = dateAttr || dateText ? parseDate(dateAttr || dateText) : undefined;
                const pubDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

                const category = $el
                    .find('.blog-card-meta span')
                    .toArray()
                    .map((span) => $(span).text().trim())
                    .filter(Boolean);
                const image = $el.find('img.blog-card-image, img').first().attr('src')?.trim() || undefined;

                seen.add(link);
                return {
                    title,
                    link,
                    description: excerpt || title,
                    pubDate,
                    category: category.length > 0 ? category : undefined,
                    image,
                };
            })
            .filter((item): item is DataItem => item !== null);

        if (items.length === 0) {
            throw new Error('No articles found on Ideogram Blog');
        }

        return {
            title: 'Ideogram Blog',
            link: BLOG_URL,
            description: 'Technical details, workflow tips, and updates from Ideogram AI',
            language: 'en' as const,
            item: items,
        };
    },
};
