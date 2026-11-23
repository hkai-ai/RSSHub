import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parsePrimeIntellectBlog } from './pure';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/primeintellect/blog',
    maintainers: ['claude'],
    url: 'www.primeintellect.ai/blog',
    radar: [{ source: ['www.primeintellect.ai/blog'], target: '/blog' }],
    handler: async () => {
        const link = 'https://www.primeintellect.ai/blog';
        const item = parsePrimeIntellectBlog(await ofetch(link));
        if (!item.length) {
            throw new Error('Prime Intellect article cards were not found in the official blog page');
        }
        return { title: 'Prime Intellect Blog', link, item };
    },
};
