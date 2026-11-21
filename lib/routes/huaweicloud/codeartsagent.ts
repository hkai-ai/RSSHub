import { load } from 'cheerio';

import type { Route } from '@/types';
import { absoluteProductLinks, fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://support.huaweicloud.com/wtsnew-codeartsagent/index.html';
export const parseUpdates = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('.wtsnew-table-date')
            .toArray()
            .map((element) => {
                const date = $(element).text().trim();
                const table = $(element).nextAll('table').first();
                return {
                    title: `${date} ${table.find('tbody tr').first().find('td').eq(1).text().trim()}`,
                    link,
                    guid: `huaweicloud-codeartsagent:${date}`,
                    pubDate: productDate(date),
                    description: absoluteProductLinks($, $.html(table), link),
                };
            }),
        '华为云码道'
    );
};
export const route: Route = {
    path: '/codeartsagent/updates',
    name: '码道代码智能体更新',
    categories: ['program-update'],
    example: '/huaweicloud/codeartsagent/updates',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: '华为云码道 CodeArts代码智能体 最新动态', link, item: parseUpdates(await fetchProductHtml(link)) }),
};
