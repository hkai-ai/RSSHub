import type { Route } from '@/types';
import { fetchProductHtml, parseProductSections, requireProductItems } from '@/utils/product-updates';

const link = 'https://cloud.baidu.com/doc/MIAODA/s/Zmm32qp8x';
export const parseChangelog = (html: string) => requireProductItems(parseProductSections(html, link, '.post__body h2'), '百度秒哒');
export const route: Route = {
    path: '/miaoda/changelog',
    name: '秒哒更新日志',
    categories: ['program-update'],
    example: '/baidu/miaoda/changelog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: '百度秒哒 更新日志', link, item: parseChangelog(await fetchProductHtml(link)) }),
};
