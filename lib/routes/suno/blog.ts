import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://suno.com';
const blogUrl = `${baseUrl}/blog`;

const DATE_RE = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4})\b/i;

const CATEGORY_SLUG_ALIASES: Record<string, string> = {
    'product-update': 'product-updates',
    'product-updates': 'product-updates',
    announcement: 'announcements',
    announcements: 'announcements',
    partnership: 'partnerships',
    partnerships: 'partnerships',
    spotlight: 'spotlights',
    spotlights: 'spotlights',
};

const normalizeCategorySlug = (tag?: string): string | undefined => {
    if (!tag) {
        return;
    }
    const slug = tag
        .replaceAll('+', ' ')
        .trim()
        .toLowerCase()
        .replaceAll(/\s+/g, '-');
    return CATEGORY_SLUG_ALIASES[slug] ?? slug;
};

const findPosts = (value: unknown): unknown[] | undefined => {
    if (!value || typeof value !== 'object') {
        return;
    }
    if ('posts' in value && Array.isArray(value.posts)) {
        return value.posts;
    }
    for (const child of Object.values(value)) {
        const posts = findPosts(child);
        if (posts) {
            return posts;
        }
    }
};

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();

    // 1. Current SSR card layout on /blog/all and /blog/category/<slug>
    $('a[href^="/blog/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || href === '/blog/all' || href.startsWith('/blog/category/')) {
            return;
        }
        const url = new URL(href, baseUrl).href;
        if (items.has(url)) {
            return;
        }

        // Walk up to the enclosing card container that only links to this single blog post
        let $card = $(el).parent();
        for (let depth = 0; depth < 5 && $card.length; depth++) {
            const parent = $card.parent();
            if (!parent.length) {
                break;
            }
            const distinctPostHrefs = new Set(
                parent
                    .find('a[href^="/blog/"]')
                    .toArray()
                    .map((a) => $(a).attr('href'))
                    .filter((h): h is string => !!h && h !== '/blog/all' && !h.startsWith('/blog/category/'))
            );
            if (distinctPostHrefs.size > 1) {
                break;
            }
            $card = parent;
        }

        const title =
            $card.find('h1, h2, h3, h4').first().text().trim() ||
            $card
                .find(`a[href="${href}"]`)
                .toArray()
                .map((a) => $(a).text().trim())
                .find(Boolean) ||
            '';
        if (!title) {
            return;
        }

        const cardText = $card.text().replaceAll(/\s+/g, ' ').trim();
        const dateMatch = cardText.match(DATE_RE);
        const pubDate = dateMatch ? parseDate(dateMatch[1]) : undefined;
        const authorMatch = cardText.match(/\bBy\s+([^·|]+?)(?:\s*·|\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i);
        const description = $card
            .find('p')
            .toArray()
            .map((p) => $(p).text().trim())
            .find((text) => text && text !== title && !DATE_RE.test(text) && !text.startsWith('By '));
        const category = $card
            .find('a[href^="/blog/category/"]')
            .toArray()
            .map((a) => $(a).text().trim())
            .filter(Boolean);
        const image = $card.find('img').first().attr('src');

        items.set(url, {
            title,
            link: url,
            pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
            description,
            author: authorMatch?.[1]?.trim(),
            category: [...new Set(category)],
            image,
        });
    });

    // 2. JSON-LD ItemList fallback
    if (!items.size) {
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const json = JSON.parse($(el).text());
                const list = json?.mainEntity?.itemListElement;
                if (Array.isArray(list)) {
                    for (const entry of list) {
                        if (entry?.url && entry?.name && !items.has(entry.url)) {
                            items.set(entry.url, {
                                title: entry.name,
                                link: entry.url,
                            });
                        }
                    }
                }
            } catch {
                // ignore malformed json-ld
            }
        });
    }

    // 3. Legacy Next.js Flight payload fallback
    if (!items.size) {
        const flight = $('script')
            .toArray()
            .flatMap((element) => [...($(element).html() ?? '').matchAll(/self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g)].map((match) => JSON.parse(match[1]) as string))
            .join('');
        let posts: unknown[] | undefined;
        for (const record of flight.split('\n')) {
            const json = record.slice(record.indexOf(':') + 1);
            if (!json.startsWith('[')) {
                continue;
            }
            try {
                posts = findPosts(JSON.parse(json));
            } catch {
                continue;
            }
            if (posts) {
                break;
            }
        }
        for (const value of posts ?? []) {
            if (!value || typeof value !== 'object') {
                continue;
            }
            const post = value as Record<string, unknown>;
            const slug = post.slug as { current?: string } | undefined;
            if (!slug?.current || typeof post.title !== 'string' || typeof post.publishedAt !== 'string') {
                continue;
            }
            const pubDate = parseDate(post.publishedAt);
            if (Number.isNaN(pubDate.getTime())) {
                continue;
            }
            const url = `${blogUrl}/${slug.current}`;
            items.set(url, {
                title: post.title,
                link: url,
                pubDate,
                description: typeof post.excerpt === 'string' ? post.excerpt : undefined,
                author: typeof post.author === 'string' ? post.author : undefined,
                category: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === 'string') : [],
            });
        }
    }

    if (!items.size) {
        throw new Error('No Suno blog posts found in page data');
    }

    return [...items.values()].toSorted((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
};

export const handler = async (ctx) => {
    const { tag } = ctx.req.param();
    const categorySlug = normalizeCategorySlug(tag);
    const targetUrl = categorySlug ? `${blogUrl}/category/${categorySlug}` : `${blogUrl}/all`;
    const html = await ofetch(targetUrl);
    const items = parsePosts(html);
    const displayTag = tag?.replaceAll('+', ' ').trim();

    return {
        title: displayTag ? `Suno Blog - ${displayTag}` : 'Suno Blog',
        link: targetUrl,
        description: 'Latest posts from Suno - building a future where anyone can make great music',
        item: items,
    };
};

export const route: Route = {
    path: '/blog/:tag?',
    name: 'Blog',
    categories: ['programming'],
    example: '/suno/blog',
    parameters: { tag: 'Optional tag filter; use product+update for Product Update.' },
    radar: [{ source: ['suno.com/blog'], target: '/suno/blog' }],
    maintainers: ['claude-code'],
    handler,
};
