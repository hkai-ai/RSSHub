import type { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/updates',
    categories: ['new-media'],
    example: '/midjourney/updates',
    parameters: {},
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
            source: ['midjourney.com/updates'],
            target: '/updates',
        },
    ],
    name: 'Updates',
    maintainers: [''],
    handler,
};

async function handler() {
    const rootUrl = 'https://www.midjourney.com';
    const apiUrl = 'https://midjourney.ghost.io/ghost/api/content/posts/';

    const response = await got({
        method: 'get',
        url: apiUrl,
        searchParams: {
            key: '6142546acd7a845384c9871544',
            limit: 200,
            include: 'tags',
            filter: 'tag:announcement,tag:changelog+tag:-alpha',
        },
    });

    const data = response.data;

    if (!data.posts) {
        throw new Error('No posts found in API response');
    }

    const items = data.posts.map((item) => ({
        title: item.title,
        link: item.url,
        description: item.excerpt || item.html?.replaceAll(/<[^>]*>/g, '').slice(0, 200) + '...',
        pubDate: parseDate(item.published_at),
        category: item.tags?.map((tag) => tag.name) || [],
        author: 'Midjourney Team',
    }));

    return {
        title: 'Midjourney - Updates',
        link: `${rootUrl}/updates`,
        description: 'Latest updates and announcements from Midjourney',
        item: items,
    };
}
