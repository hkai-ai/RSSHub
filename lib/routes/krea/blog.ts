import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.krea.ai';
const BLOG_URL = `${BASE_URL}/blog`;

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'programming'],
    example: '/krea/blog',
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
            source: ['www.krea.ai/blog', 'www.krea.ai/blog/*'],
            target: '/blog',
        },
    ],
    url: 'www.krea.ai/blog',
    handler: async (): Promise<Data> => {
        const html = await ofetch<string>(BLOG_URL, { parseResponse: (txt) => txt });
        const $ = load(html);

        const seen = new Set<string>();
        const items: DataItem[] = $('a.post-card[href]')
            .toArray()
            .map((el): DataItem | null => {
                const $el = $(el);
                const href = $el.attr('href')?.trim() ?? '';
                if (!href || !href.startsWith('/blog/') || href.includes('/category/')) {
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

                const author = $el.find('.post-card-byline span').first().text().trim() || undefined;
                const dateAttr = $el.find('time').first().attr('datetime')?.trim();
                const dateText = $el.find('time').first().text().trim();
                const parsedDate = dateAttr || dateText ? parseDate(dateAttr || dateText) : undefined;
                const pubDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

                const category = $el.find('.post-card-category').first().text().trim() || $el.attr('data-category')?.trim() || '';
                const image = $el.find('.post-card-media img, img').first().attr('src')?.trim() || undefined;
                const summary = $el.find('p').first().text().replaceAll(/\s+/g, ' ').trim();

                seen.add(link);
                return {
                    title,
                    link,
                    description: summary || title,
                    author,
                    pubDate,
                    category: category ? [category] : undefined,
                    image,
                };
            })
            .filter((item): item is DataItem => item !== null);

        if (items.length === 0) {
            throw new Error('No articles found on Krea Blog');
        }

        return {
            title: 'Krea Blog',
            link: BLOG_URL,
            description: 'Product announcements, research launches, tutorials, and stories from the Krea team.',
            language: 'en' as const,
            item: items,
        };
    },
};
