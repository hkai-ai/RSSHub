import { load } from 'cheerio';

import type { Route } from '@/types';
import { absoluteProductLinks, fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://zcode.z.ai/cn/changelog';
export const parseChangelog = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('article')
            .toArray()
            .flatMap((element) => {
                const entry = $(element).parent();
                const title = entry.children('h2').first().text().trim();
                if (!title.startsWith('Release v')) {
                    return [];
                }
                const version = title.replace(/^Release /, '');
                const container = entry.parent();
                return [{ title, link, guid: `zcode:${version}`, description: absoluteProductLinks($, $(element).html() ?? '', link), pubDate: productDate(container.children().not(entry).text()) }];
            }),
        'ZCode'
    );
};
export const route: Route = {
    path: '/changelog',
    name: '版本发布与更新',
    categories: ['program-update'],
    example: '/zcode/changelog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'ZCode 版本发布与更新', link, item: parseChangelog(await fetchProductHtml(link)) }),
};
