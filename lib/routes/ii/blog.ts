import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const link = 'https://ii.inc/blog';

interface Post {
    slug: string;
    title: string;
    excerpt: string;
    published_at: string;
    primary_author?: { name: string };
    feature_image?: string;
}

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const data = JSON.parse($('#__NEXT_DATA__').text());
    const posts: Post[] = data.props?.pageProps?.posts;
    if (!Array.isArray(posts) || !posts.length) {
        throw new Error('No Intelligent Internet blog posts found');
    }
    return posts.map((post) => ({
        title: post.title,
        link: new URL(`/blog/post/${post.slug}`, link).href,
        description: post.excerpt,
        pubDate: parseDate(post.published_at),
        author: post.primary_author?.name,
        image: post.feature_image ? new URL(post.feature_image, link).href : undefined,
    }));
};

export const handler = async () => ({
    title: 'Intelligent Internet - Blog',
    link,
    description: 'Intelligent Internet Blog',
    language: 'en' as const,
    item: parsePosts(await ofetch(link)),
});

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/ii/blog',
    maintainers: ['claude'],
    handler,
    url: 'ii.inc/blog',
    radar: [{ source: ['ii.inc/blog', 'ii.inc/web/blog'], target: '/blog' }],
};
