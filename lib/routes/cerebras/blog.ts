import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseCerebrasBlog } from './pure';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/cerebras/blog',
    maintainers: ['claude'],
    description: 'Official engineering and product blog posts from Cerebras.',
    url: 'www.cerebras.ai/blog',
    radar: [{ source: ['www.cerebras.ai/blog'], target: '/blog' }],
    handler: async () => {
        const link = 'https://www.cerebras.ai/blog';
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseCerebrasBlog(html);
        if (!item.length) {
            throw new Error('Cerebras blog articles were not found');
        }
        return {
            title: 'Cerebras AI Blog',
            link,
            item,
        };
    },
};
