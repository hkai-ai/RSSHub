import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://viggle.ai';
const BLOG_URL = `${BASE_URL}/blog`;
const MAX_POSTS = 20;

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'programming'],
    example: '/viggle/blog',
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
            source: ['viggle.ai/blog', 'viggle.ai/blog/*'],
            target: '/blog',
        },
    ],
    url: 'viggle.ai/blog',
    handler: async (): Promise<Data> => {
        const html = await ofetch<string>(BLOG_URL, { parseResponse: (txt) => txt });
        const $ = load(html);

        const seen = new Set<string>();
        const listItems: Array<{ title: string; link: string; category?: string[]; image?: string }> = [];

        $('a[href^="/blog/"]')
            .toArray()
            .forEach((el) => {
                const $el = $(el);
                const href = $el.attr('href')?.trim() ?? '';
                if (!href || href === '/blog/' || href.includes('#')) {
                    return;
                }

                const link = new URL(href, BASE_URL).href;
                if (seen.has(link)) {
                    return;
                }

                const title = $el.find('h2, h3').first().text().replaceAll(/\s+/g, ' ').trim();
                if (!title) {
                    return;
                }

                const image = $el.find('img').first().attr('src')?.trim() || undefined;
                const categoryText = $el
                    .children('div')
                    .toArray()
                    .map((d) => $(d).text().trim())
                    .find((t) => t.length > 0 && t.length <= 32);

                seen.add(link);
                listItems.push({
                    title,
                    link,
                    category: categoryText ? [categoryText] : undefined,
                    image,
                });
            });

        if (listItems.length === 0) {
            throw new Error('No articles found on Viggle Blog');
        }

        const items = await Promise.all(
            listItems.slice(0, MAX_POSTS).map((entry) =>
                cache.tryGet(entry.link, async (): Promise<DataItem> => {
                    const postHtml = await ofetch<string>(entry.link, { parseResponse: (txt) => txt });
                    const $post = load(postHtml);

                    const timeAttr = $post('time').first().attr('datetime')?.trim();
                    const timeText = $post('time').first().text().trim();
                    const parsedDate = timeAttr || timeText ? parseDate(timeAttr || timeText) : undefined;
                    const pubDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

                    const author = $post('time').first().parent().find('span').first().text().trim() || undefined;
                    const articleHtml = $post('article').first().html()?.trim() ?? '';
                    const metaDesc = $post('meta[name="description"]').attr('content')?.trim() ?? '';

                    return {
                        title: entry.title,
                        link: entry.link,
                        description: articleHtml || metaDesc || entry.title,
                        author,
                        pubDate,
                        category: entry.category,
                        image: entry.image,
                    };
                })
            )
        );

        return {
            title: 'Viggle Blog',
            link: BLOG_URL,
            description: 'AI Animation, Creator Stories & Guides from Viggle',
            language: 'en' as const,
            item: items as DataItem[],
        };
    },
};
