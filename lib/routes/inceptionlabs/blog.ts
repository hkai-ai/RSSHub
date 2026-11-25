import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const ROOT_URL = 'https://www.inceptionlabs.ai';
const SITEMAP_URL = `${ROOT_URL}/sitemap.xml`;
const MAX_POSTS = 15;
const BATCH_SIZE = 3;

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/inceptionlabs/blog',
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
            source: ['www.inceptionlabs.ai/blog', 'www.inceptionlabs.ai/blog/*'],
            target: '/inceptionlabs/blog',
        },
    ],
    name: 'Blog',
    maintainers: ['zdenek-stursa'],
    handler,
    url: 'inceptionlabs.ai/blog',
};

interface ParsedPost {
    title: string;
    link: string;
    description: string;
    author: string;
    category: string[];
    pubDate?: Date;
    relatedDates: Record<string, string>;
}

const extractBlogUrlsFromSitemap = (xml: string): string[] => {
    const $ = load(xml, { xmlMode: true });
    const seen = new Set<string>();
    const urls: string[] = [];

    $('url > loc')
        .toArray()
        .forEach((el) => {
            const loc = $(el).text().trim();
            if (!loc || !loc.includes('/blog/')) {
                return;
            }
            if (loc.includes('/categories') || seen.has(loc)) {
                return;
            }
            seen.add(loc);
            urls.push(loc);
        });

    return urls.slice(0, MAX_POSTS);
};

async function handler(): Promise<Data> {
    const sitemapXml = await ofetch<string>(SITEMAP_URL, { parseResponse: (txt) => txt });
    const postUrls = extractBlogUrlsFromSitemap(sitemapXml);

    if (postUrls.length === 0) {
        throw new Error('No blog URLs found in Inception Labs sitemap');
    }

    const parsedPosts: Array<ParsedPost | null> = [];
    for (let offset = 0; offset < postUrls.length; offset += BATCH_SIZE) {
        const batch = await Promise.all(
            postUrls.slice(offset, offset + BATCH_SIZE).map(async (link): Promise<ParsedPost | null> => {
                try {
                    const cached = await cache.tryGet(link, async (): Promise<ParsedPost> => {
                        const postHtml = await ofetch<string>(link, { parseResponse: (txt) => txt });
                        const $post = load(postHtml);

                        const h1 = $post('h1').first().text().replaceAll(/\s+/g, ' ').trim();
                        const ogTitle = $post('meta[property="og:title"]').attr('content')?.replace(/\s*[–-]\s*Inception\s*$/i, '').trim() ?? '';
                        const title = h1 || ogTitle || link;

                        const contentHtml = $post('[data-framer-name="Content"]').first().html()?.trim() ?? '';
                        const metaDesc = $post('meta[name="description"]').attr('content')?.trim() ?? '';
                        const author = $post('[data-framer-name="Author"] p.framer-text').first().text().trim();

                        const heroLabel = $post('[data-framer-name="Hero"] p').first().text().trim();
                        const categoryMatch = heroLabel.match(/Blog\s*\/\s*(.+)/i);
                        const category = categoryMatch?.[1]?.trim() ? [categoryMatch[1].trim()] : [];

                        // Collect dates exposed in related post cards on this page so each post gets its exact date if available
                        const relatedDates: Record<string, string> = {};
                        $post('a[href*="/blog/"]')
                            .toArray()
                            .forEach((a) => {
                                const $a = $post(a);
                                const href = $a.attr('href')?.trim();
                                const dt = $a.find('time').first().attr('datetime')?.trim() || $a.find('time').first().text().trim();
                                if (href && dt) {
                                    const fullUrl = new URL(href, ROOT_URL).href;
                                    relatedDates[fullUrl] = dt;
                                }
                            });

                        const directTime =
                            $post('[data-framer-name="Hero"] time').first().attr('datetime')?.trim() ||
                            $post('meta[property="article:published_time"]').attr('content')?.trim() ||
                            $post('body').attr('data-framer-ssr-released-at')?.trim() ||
                            postHtml.match(/data-framer-ssr-released-at="([^"]+)"/)?.[1];

                        const parsedDate = directTime ? parseDate(directTime) : undefined;
                        const pubDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

                        return {
                            title,
                            link,
                            description: contentHtml || metaDesc || title,
                            author,
                            category,
                            pubDate,
                            relatedDates,
                        };
                    });
                    return cached as ParsedPost;
                } catch {
                    return null;
                }
            })
        );
        parsedPosts.push(...batch);
    }

    // Cross-reference exact dates discovered in related cards across fetched posts
    const crossDates = new Map<string, Date>();
    for (const post of parsedPosts) {
        if (!post?.relatedDates) {
            continue;
        }
        for (const [url, dt] of Object.entries(post.relatedDates)) {
            const d = parseDate(dt);
            if (!Number.isNaN(d.getTime())) {
                crossDates.set(url, d);
            }
        }
    }

    const items: DataItem[] = parsedPosts
        .filter((p): p is ParsedPost => Boolean(p && p.title))
        .map((post) => ({
            title: post.title,
            link: post.link,
            description: post.description,
            author: post.author || undefined,
            category: post.category.length > 0 ? post.category : undefined,
            pubDate: crossDates.get(post.link) ?? post.pubDate,
        }));

    if (items.length === 0) {
        throw new Error('Failed to fetch any blog articles from Inception Labs');
    }

    return {
        title: 'Inception Labs Blog',
        link: `${ROOT_URL}/blog`,
        description: 'Latest posts from the Inception Labs blog about diffusion LLMs and AI research',
        language: 'en' as const,
        item: items,
    };
}
