import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseArticleList } from './list';

const baseUrl = 'https://www.anthropic.com';
const link = `${baseUrl}/engineering`;

export const parseEngineering = (html: string) => parseArticleList(html, 'engineering');

export const handler = async () => ({
    title: 'Anthropic Engineering',
    link,
    description: 'Latest engineering posts from Anthropic',
    image: `${baseUrl}/images/icons/apple-touch-icon.png`,
    item: parseEngineering(await ofetch(link)),
});

export const route: Route = {
    path: '/engineering',
    categories: ['programming'],
    example: '/anthropic/engineering',
    parameters: {},
    radar: [
        {
            source: ['www.anthropic.com/engineering', 'www.anthropic.com'],
        },
    ],
    name: 'Engineering',
    maintainers: ['TonyRL'],
    handler,
    url: 'www.anthropic.com/engineering',
};
