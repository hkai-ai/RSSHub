import pMap from 'p-map';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

import { parsePoolsideArticleDate, parsePoolsideBlog } from './pure';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/poolside/blog',
    maintainers: ['claude'],
    url: 'poolside.ai/blog',
    radar: [{ source: ['poolside.ai/blog'], target: '/blog' }],
    handler: async () => {
        const link = 'https://poolside.ai/blog';
        const list = parsePoolsideBlog(await ofetch(link));
        if (!list.length) {
            throw new Error('Poolside article cards were not found in the official blog page');
        }
        const item = await pMap(
            list,
            (entry) => {
                if (entry.pubDate) {
                    return entry;
                }
                return cache.tryGet(`poolside:article:${entry.link}`, async () => ({ ...entry, pubDate: parsePoolsideArticleDate(await ofetch(entry.link!)) }));
            },
            { concurrency: 3 }
        );
        return { title: 'Poolside Blog', link, item };
    },
};
