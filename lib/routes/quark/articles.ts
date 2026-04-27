import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';

export const route: Route = {
    path: '/articles',
    name: '官方快讯',
    url: 'www.quark.cn/articles',
    maintainers: ['user'],
    categories: ['new-media'],
    example: '/quark/articles',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['quark.cn/articles'],
            target: '/articles',
        },
    ],
    handler: async (): Promise<Data> => {
        const baseUrl = 'https://www.quark.cn';
        const listUrl = `${baseUrl}/articles`;

        return (await cache.tryGet(
            listUrl,
            async () => {
                const html = await fetchHtmlWithFallback(listUrl, {
                    fallbackOptions: {
                        waitUntil: 'networkidle',
                        isBanResourceRequest: true,
                    },
                });

                const $ = load(html);

                const seen = new Set<string>();
                const items: DataItem[] = $('a[href*="/articles/"]')
                    .toArray()
                    .map((el) => {
                        const $a = $(el);
                        const href = $a.attr('href') || '';
                        // 仅保留 `/articles/<digits>.html` 形式的真实文章链接
                        const match = href.match(/\/articles\/(\d+)\.html$/);
                        if (!match) {
                            return null;
                        }

                        const link = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                        if (seen.has(link)) {
                            return null;
                        }
                        seen.add(link);

                        const title = ($a.find('h3, h2').first().text() || $a.attr('title') || $a.text()).trim();
                        if (!title) {
                            return null;
                        }
                        const description = $a.find('p').first().text().trim();
                        const image = $a.find('img').first().attr('src') || $a.find('img').first().attr('data-src');

                        return {
                            title,
                            link,
                            description: description || title,
                            author: '夸克',
                            guid: link,
                            ...(image && { image }),
                        } as DataItem;
                    })
                    .filter((it): it is DataItem => it !== null);

                return {
                    title: '夸克官方快讯',
                    link: listUrl,
                    description: '夸克官方快讯和文章更新',
                    language: 'zh-CN',
                    item: items,
                };
            },
            1800,
            false
        )) as Data;
    },
};
