import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

interface ReplitPost {
    title?: string;
    slug?: string;
    summary?: string;
    publishedAt?: string;
    coverImage?: {
        url?: string;
        asset?: { url?: string };
    };
    authors?: Array<{ name?: string }>;
}

function mapReplitPost(post: ReplitPost): DataItem | null {
    const title = post?.title?.trim();
    const slug = post?.slug?.trim();
    if (!title || !slug) {
        return null;
    }

    const link = `https://replit.com/blog/${slug.replace(/^\/+/, '')}`;
    const pubDate = post.publishedAt ? parseDate(post.publishedAt) : undefined;
    const author = post.authors && post.authors.length > 0 && post.authors[0]?.name ? post.authors[0].name : 'Replit Team';
    const image = post.coverImage?.asset?.url || post.coverImage?.url;

    let description = post.summary || title;
    if (image) {
        description = `<img src="${image}" alt="${title}"><br><br>${description}`;
    }

    return {
        title,
        link,
        description,
        author,
        pubDate,
        category: ['programming', 'blog'],
    };
}

export function parseReplitNextData(nextDataRaw: string | Record<string, any>): DataItem[] {
    const nextData = typeof nextDataRaw === 'string' ? JSON.parse(nextDataRaw) : nextDataRaw;
    const data = nextData?.props?.pageProps?.data || nextData?.props?.pageProps || {};
    const posts: ReplitPost[] = Array.isArray(data.posts) ? data.posts : [];

    const byUrl = new Map<string, DataItem>();
    for (const post of posts) {
        const mapped = mapReplitPost(post);
        if (mapped?.link) {
            byUrl.set(mapped.link, mapped);
        }
    }

    const featuredPost: ReplitPost | undefined = data.featuredPost;
    if (featuredPost?.slug) {
        const mappedFeatured = mapReplitPost(featuredPost);
        if (mappedFeatured?.link && !byUrl.has(mappedFeatured.link)) {
            byUrl.set(mappedFeatured.link, mappedFeatured);
        }
    }

    return [...byUrl.values()].sort((a, b) => {
        const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return tb - ta;
    });
}

export const route: Route = {
    path: '/blog',
    name: 'Replit Blog',
    categories: ['programming', 'blog'],
    example: '/replit/blog',
    maintainers: ['claude'],
    handler: async () => {
        try {
            const response = await ofetch('https://replit.com/blog');
            const $ = load(response);

            const nextDataScript = $('#__NEXT_DATA__').html();
            if (!nextDataScript) {
                throw new Error('Could not find __NEXT_DATA__ script tag');
            }

            const items = parseReplitNextData(nextDataScript);

            return {
                title: 'Replit Blog',
                link: 'https://replit.com/blog',
                description: 'The official blog from Replit, featuring updates on features, tutorials, and community stories.',
                item: items,
                language: 'en',
            };
        } catch (error) {
            logger.error('Error fetching Replit blog:', error);
            throw new Error('Failed to fetch Replit blog data', { cause: error });
        }
    },
};
