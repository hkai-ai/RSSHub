import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/ii/blog',
    maintainers: ['claude'],
    handler,
    url: 'ii.inc/web/blog',
    radar: [
        {
            source: ['ii.inc/web/blog'],
            target: '/ii/blog',
        },
    ],
};

async function handler() {
    const baseUrl = 'https://ii.inc';
    const apiUrl = `${baseUrl}/web/api/ghost/posts?page=1&limit=20&include=authors%2Ctags&order=featured%20DESC%2C%20published_at%20DESC`;

    const data = await ofetch(apiUrl);
    const posts = data.posts;

    const items: DataItem[] = posts.map((post) => ({
        title: post.title,
        link: `${baseUrl}/web/blog/${post.slug}`,
        description: post.html,
        pubDate: parseDate(post.published_at),
        updated: parseDate(post.updated_at),
        author: post.authors?.map((a) => a.name).join(', '),
        category: post.tags?.map((t) => t.name),
        banner: post.feature_image,
    }));

    return {
        title: 'Intelligent Internet - Blog',
        link: `${baseUrl}/web/blog`,
        description: 'Intelligent Internet Blog',
        language: 'en' as const,
        item: items,
    };
}
