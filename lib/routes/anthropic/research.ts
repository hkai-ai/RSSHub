import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseArticleList } from './list';

const link = 'https://www.anthropic.com/research';

export const parseResearch = (html: string) => parseArticleList(html, 'research');

export const handler = async () => ({
    title: 'Anthropic Research',
    link,
    description: 'Latest research from Anthropic',
    item: parseResearch(await ofetch(link)),
});

export const route: Route = {
    path: '/research',
    categories: ['programming'],
    example: '/anthropic/research',
    radar: [{ source: ['www.anthropic.com/research', 'www.anthropic.com'], target: '/research' }],
    name: 'Research',
    maintainers: ['ttttmr'],
    handler,
    url: 'www.anthropic.com/research',
};
