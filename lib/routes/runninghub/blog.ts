import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://www.runninghub.cn/blog';

export const parseBlog = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('article')
            .toArray()
            .flatMap((element) => {
                const entry = $(element);
                const href = entry.find('a[href]').first().attr('href');
                if (!href || !entry.find('h1,h2').length) {
                    return [];
                }
                return [
                    {
                        title: entry.find('h1,h2').first().text().trim(),
                        link: new URL(href, link).href,
                        description: entry.find('.article-desc,.feed-summary').first().html() ?? '',
                        pubDate: productDate(entry.find('.article-meta,.feed-meta').text()),
                        author: entry.find('.blog-author-link').first().text().trim(),
                    },
                ];
            }),
        'RunningHub'
    );
};

export const route: Route = {
    path: '/blog',
    name: '官方博客与教程',
    categories: ['blog'],
    example: '/runninghub/blog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'RunningHub 官方博客与教程', link, item: parseBlog(await fetchProductHtml(link)) }),
};
