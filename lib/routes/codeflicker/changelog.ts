import type { Route } from '@/types';
import { fetchProductHtml, parseProductSections, requireProductItems } from '@/utils/product-updates';

const link = 'https://www.codeflicker.ai/docs/changelog.html';
export const parseChangelog = (html: string) => requireProductItems(parseProductSections(html, link, '.vp-doc h2'), 'CodeFlicker');
export const route: Route = {
    path: '/changelog',
    name: '更新日志',
    categories: ['program-update'],
    example: '/codeflicker/changelog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'CodeFlicker 更新日志', link, item: parseChangelog(await fetchProductHtml(link)) }),
};
