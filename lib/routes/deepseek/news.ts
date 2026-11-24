import pMap from 'p-map';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

import { findDeepSeekNewsPage, parseDeepSeekArticle, parseDeepSeekNews } from './pure';

const rootUrl = 'https://api-docs.deepseek.com/zh-cn/';

export const route: Route = {
    path: '/news',
    name: '新闻',
    categories: ['programming'],
    example: '/deepseek/news',
    maintainers: ['1837634311'],
    radar: [{ source: ['api-docs.deepseek.com/zh-cn/news'], target: '/news' }],
    handler: async () => {
        const pageUrl = findDeepSeekNewsPage(await ofetch(rootUrl));
        if (!pageUrl) {
            throw new Error('DeepSeek documentation navigation no longer exposes a news page');
        }
        const list = parseDeepSeekNews(await ofetch(pageUrl));
        if (!list.length) {
            throw new Error('DeepSeek dated news links were not found in the documentation sidebar');
        }
        const item = await pMap(list, (entry) => cache.tryGet(`deepseek:news:${entry.link}`, async () => ({ ...entry, description: parseDeepSeekArticle(await ofetch(entry.link!)) })), { concurrency: 3 });
        return { title: 'DeepSeek 新闻', link: pageUrl, item };
    },
};
