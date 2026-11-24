import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseDeepSeekUpdates } from './pure';

export const route: Route = {
    path: '/updates',
    name: 'API Change Log',
    categories: ['program-update'],
    example: '/deepseek/updates',
    maintainers: ['claude'],
    url: 'api-docs.deepseek.com/updates',
    radar: [{ source: ['api-docs.deepseek.com/updates'], target: '/updates' }],
    handler: async () => {
        const link = 'https://api-docs.deepseek.com/updates';
        const item = parseDeepSeekUpdates(await ofetch(link));
        if (!item.length) {
            throw new Error('DeepSeek dated update sections were not found in the official change log');
        }
        return { title: 'DeepSeek API Change Log', link, item };
    },
};
