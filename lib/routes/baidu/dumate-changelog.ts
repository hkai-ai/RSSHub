import type { Route } from '@/types';
import { fetchProductHtml, parseProductSections, requireProductItems } from '@/utils/product-updates';

const link = 'https://aca.bce.baidu.com/doc/Dumate/s/cmmu7shvw';
export const parseChangelog = (html: string) => requireProductItems(parseProductSections(html, link, '.post__body h2'), '百度搭子');
export const route: Route = {
    path: '/dumate/changelog',
    name: '搭子个人版更新动态',
    categories: ['program-update'],
    example: '/baidu/dumate/changelog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: '百度搭子 个人版更新动态', link, item: parseChangelog(await fetchProductHtml(link)) }),
};
