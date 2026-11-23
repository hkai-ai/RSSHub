import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import type { JinaPost } from './pure';
import { extractJinaContentKey, mapJinaPosts } from './pure';

export const route: Route = {
    path: '/news',
    name: 'News',
    categories: ['programming'],
    example: '/jina/news',
    maintainers: ['claude'],
    url: 'jina.ai/news/',
    radar: [{ source: ['jina.ai/news'], target: '/news' }],
    handler: async () => {
        const link = 'https://jina.ai/news/';
        const $ = load(await ofetch(link));
        const mainPath = $('script[type="module"][src]').first().attr('src');
        if (!mainPath?.startsWith('/assets/')) {
            throw new Error('Jina official application bundle was not found');
        }
        const main = await ofetch<string>(new URL(mainPath, link).href, { responseType: 'text' });
        const blogPath = main.match(/(?:assets\/|\.\/)blogs-[\w-]+\.js/)?.[0];
        if (!blogPath) {
            throw new Error('Jina public news data module was not found');
        }
        const script = await ofetch<string>(new URL(blogPath.replace(/^\.\//, '/assets/'), 'https://jina.ai/').href, { responseType: 'text' });
        const key = extractJinaContentKey(script);
        if (!key) {
            throw new Error('Jina public Ghost Content API key was not found in its news module');
        }
        const api = new URL('https://cms.jina.ai/ghost/api/content/posts/');
        api.search = new URLSearchParams({ key, limit: '30', include: 'authors,tags' }).toString();
        const data = await ofetch<{ posts: JinaPost[] }>(api.href);
        const item = mapJinaPosts(data.posts || []);
        if (!item.length) {
            throw new Error('Jina public news API returned no usable articles');
        }
        return { title: 'Jina AI News', link, item };
    },
};
