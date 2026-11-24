import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseArticleList } from './list';

export const route: Route = {
    path: '/news',
    categories: ['programming'],
    example: '/anthropic/news',
    radar: [{ source: ['www.anthropic.com/news', 'www.anthropic.com'], target: '/news' }],
    name: 'News',
    maintainers: ['etShaw-zh', 'goestav'],
    handler,
    url: 'www.anthropic.com/news',
};

export async function handler() {
    const link = 'https://www.anthropic.com/news';
    return {
        title: 'Anthropic News',
        link,
        item: parseArticleList(await ofetch(link), 'news'),
    };
}
