import { load } from 'cheerio';

import type { Route } from '@/types';
import { absoluteProductLinks, fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://www.flova.ai/zh-CN/docs/changelog/';
export const parseChangelog = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('.changelog-entry')
            .toArray()
            .map((element) => {
                const entry = $(element);
                const date = entry.find('time').first().attr('datetime');
                const id = entry.attr('id');
                return {
                    title: `${date} ${entry.find('h2').first().text().trim()}`,
                    link: `${link}#${id ?? `changelog-${date}`}`,
                    description: absoluteProductLinks(
                        $,
                        entry
                            .find('.changelog-item')
                            .toArray()
                            .map((item) => $.html(item))
                            .join(''),
                        link
                    ),
                    pubDate: productDate(date),
                };
            }),
        'Flova'
    );
};
export const route: Route = {
    path: '/changelog',
    name: '更新日志',
    categories: ['program-update'],
    example: '/flova/changelog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'Flova 更新日志', link, item: parseChangelog(await fetchProductHtml(link)) }),
};
