import type { Route } from '@/types';

import { fetchArticles } from './articles';

export const handler = async () => {
    const link = 'https://www.perplexity.ai/hub/blog';
    return {
        title: 'Perplexity Blog',
        link,
        item: await fetchArticles(link),
    };
};

export const route: Route = {
    path: '/blog',
    example: '/perplexity/blog',
    url: 'www.perplexity.ai/hub/blog',
    categories: ['blog'],
    radar: [{ source: ['www.perplexity.ai/hub', 'www.perplexity.ai/hub/blog', 'www.perplexity.ai/hub/blog/*'], target: '/blog' }],
    name: 'Blog',
    maintainers: ['seeyangzhi'],
    handler,
};
