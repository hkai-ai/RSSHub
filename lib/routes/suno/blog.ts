import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const link = 'https://suno.com/blog';

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
    // Flight records can span script tags; join the decoded string chunks first.
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
            // Other Flight records may contain module references or plain text.
            continue;
        }
        if (posts) {
            break;
        }
    }
    if (!posts?.length) {
        throw new Error('No Suno blog posts found in page data');
    }
    const items = new Map<string, DataItem>();
    for (const value of posts) {
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
        const url = `${link}/${slug.current}`;
        items.set(url, {
            title: post.title,
            link: url,
            pubDate,
            description: typeof post.excerpt === 'string' ? post.excerpt : undefined,
            author: typeof post.author === 'string' ? post.author : undefined,
            category: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        });
    }
    if (!items.size) {
        throw new Error('No valid Suno blog posts found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async (ctx) => {
    const { tag } = ctx.req.param();
    const posts = parsePosts(await ofetch(link));
    // Preserve the existing tag route used by Product Update subscribers.
    const filter = tag?.replaceAll('+', ' ').toLowerCase().trim();
    const items = filter ? posts.filter((post) => post.category?.some((category) => category.toLowerCase() === filter)) : posts;
    const displayTag = items.flatMap((post) => post.category ?? []).find((category) => category.toLowerCase() === filter);
    return {
        title: displayTag ? `Suno Blog - ${displayTag}` : 'Suno Blog',
        link,
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
