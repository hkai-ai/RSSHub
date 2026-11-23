import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseKimiBlog } from './pure';

export const route: Route = {
    path: '/blog',
    name: 'Research Blog',
    categories: ['programming'],
    example: '/kimi/blog',
    maintainers: ['claude'],
    url: 'www.kimi.com/blog/',
    radar: [{ source: ['www.kimi.com/blog'], target: '/blog' }],
    handler: async () => {
        const link = 'https://www.kimi.com/blog/';
        const item = parseKimiBlog(await ofetch(link));
        if (!item.length) {
            throw new Error('Kimi research cards were not found in the official blog page');
        }
        return { title: 'Kimi Research Blog', link, item };
    },
};
