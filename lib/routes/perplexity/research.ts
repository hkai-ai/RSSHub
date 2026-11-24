import type { Route } from '@/types';

import { fetchArticles } from './articles';

export const handler = async () => {
    const link = 'https://www.perplexity.ai/hub/blog/category/research';
    return {
        title: 'Perplexity Research',
        link,
        item: await fetchArticles(link),
    };
};

export const route: Route = {
    path: '/research',
    example: '/perplexity/research',
    url: 'www.perplexity.ai/hub/blog/category/research',
    categories: ['programming'],
    radar: [{ source: ['research.perplexity.ai', 'research.perplexity.ai/articles', 'www.perplexity.ai/hub/blog/category/research'], target: '/research' }],
    name: 'Research',
    maintainers: ['claude'],
    handler,
};
