import pMap from 'p-map';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

import { parseCerebrasArticleDate, parseCerebrasNewsroom } from './pure';

export const route: Route = {
    path: '/newsroom',
    name: 'Newsroom',
    categories: ['programming'],
    example: '/cerebras/newsroom',
    maintainers: ['claude'],
    description: 'Official press releases and blog posts linked from the newsroom; third-party media coverage is excluded.',
    url: 'www.cerebras.ai/company/newsroom',
    radar: [{ source: ['www.cerebras.ai/company/newsroom'], target: '/newsroom' }],
    handler: async () => {
        const link = 'https://www.cerebras.ai/company/newsroom';
        const list = parseCerebrasNewsroom(await ofetch(link));
        if (!list.length) {
            throw new Error('Cerebras official article cards were not found in the newsroom');
        }
        const item = await pMap(list, (entry) => cache.tryGet(`cerebras:article:${entry.link}`, async () => ({ ...entry, pubDate: parseCerebrasArticleDate(await ofetch(entry.link!)) })), { concurrency: 3 });
        return { title: 'Cerebras Newsroom', link, item };
    },
};
