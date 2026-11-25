import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.heygen.com';
const BLOG_URL = `${BASE_URL}/blog`;
const MAX_POSTS = 20;

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'programming'],
    example: '/heygen/blog',
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
            source: ['www.heygen.com/blog', 'www.heygen.com/blog/*'],
            target: '/blog',
        },
    ],
    url: 'www.heygen.com/blog',
    handler: async (): Promise<Data> => {
        const html = await ofetch<string>(BLOG_URL, { parseResponse: (txt) => txt });
        const $ = load(html);

        const seen = new Set<string>();
        const listItems: Array<{ title: string; link: string; image?: string }> = [];

        $('a[href^="/blog/"]')
            .toArray()
            .forEach((el) => {
                const $el = $(el);
                const href = $el.attr('href')?.trim() ?? '';
                if (!href || href === '/blog/' || href.includes('/category/') || href.includes('/author/') || href.includes('#')) {
                    return;
                }

                const link = new URL(href, BASE_URL).href;
                if (seen.has(link)) {
                    return;
                }

                const heading = $el.find('h2, h3, h4').first().text().replaceAll(/\s+/g, ' ').trim();
                const imgAlt = $el.find('img').first().attr('alt')?.trim() ?? '';
                const textFallback = $el.text().replaceAll(/\s+/g, ' ').trim();
                const title = heading || imgAlt || (textFallback.length <= 160 ? textFallback : '');
                if (!title) {
                    return;
                }

                const image = $el.find('img').first().attr('src')?.trim() || undefined;
                seen.add(link);
                listItems.push({ title, link, image });
            });

        if (listItems.length === 0) {
            throw new Error('No articles found on HeyGen Blog');
        }

        const items = (
            await Promise.all(
                listItems.slice(0, MAX_POSTS).map(async (entry): Promise<DataItem> => {
                    try {
                        const cached = await cache.tryGet(entry.link, async (): Promise<DataItem> => {
                            const postHtml = await ofetch<string>(entry.link, { parseResponse: (txt) => txt });
                            const $post = load(postHtml);

                            let datePublished: string | undefined;
                            let author: string | undefined;
                            let ldDescription: string | undefined;
                            let ldHeadline: string | undefined;

                            $post('script[type="application/ld+json"]')
                                .toArray()
                                .forEach((script) => {
                                    const raw = $post(script).text().trim();
                                    if (!raw) {
                                        return;
                                    }
                                    try {
                                        const parsed = JSON.parse(raw) as Record<string, unknown>;
                                        const nodes = Array.isArray(parsed['@graph']) ? (parsed['@graph'] as Array<Record<string, unknown>>) : [parsed];
                                        for (const node of nodes) {
                                            if (!datePublished && typeof node.datePublished === 'string') {
                                                datePublished = node.datePublished;
                                            }
                                            if (!ldHeadline && typeof node.headline === 'string') {
                                                ldHeadline = node.headline;
                                            }
                                            if (!ldDescription && typeof node.description === 'string') {
                                                ldDescription = node.description;
                                            }
                                            if (!author && node.author && typeof node.author === 'object' && 'name' in node.author && typeof (node.author as { name?: unknown }).name === 'string') {
                                                author = (node.author as { name: string }).name;
                                            }
                                        }
                                    } catch {
                                        // Ignore malformed JSON-LD blocks
                                    }
                                });

                            const parsedDate = datePublished ? parseDate(datePublished) : undefined;
                            const pubDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;
                            const articleHtml = $post('article').first().html()?.trim() ?? '';
                            const metaDesc = $post('meta[name="description"]').attr('content')?.trim() ?? '';

                            return {
                                title: ldHeadline || entry.title,
                                link: entry.link,
                                description: articleHtml || ldDescription || metaDesc || entry.title,
                                author,
                                pubDate,
                                image: entry.image,
                            };
                        });
                        return cached as DataItem;
                    } catch {
                        return {
                            title: entry.title,
                            link: entry.link,
                            description: entry.title,
                            image: entry.image,
                        };
                    }
                })
            )
        ).toSorted((a, b) => {
            const ta = a.pubDate instanceof Date ? a.pubDate.getTime() : 0;
            const tb = b.pubDate instanceof Date ? b.pubDate.getTime() : 0;
            return tb - ta;
        });

        return {
            title: 'HeyGen Blog',
            link: BLOG_URL,
            description: 'AI Video, Marketing & Tech Insights from HeyGen',
            language: 'en' as const,
            item: items,
        };
    },
};
