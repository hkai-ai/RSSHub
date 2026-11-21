import type { Route } from '@/types';
import { fetchProductHtml, parseProductSections, requireProductItems } from '@/utils/product-updates';

const link = 'https://www.codebuddy.cn/docs/ide/release-notes/release-notes';
export const parseChangelog = (html: string) => requireProductItems(parseProductSections(html, link, '.vp-doc h3'), 'CodeBuddy');
export const route: Route = {
    path: '/changelog',
    name: 'IDE版本更新',
    categories: ['program-update'],
    example: '/codebuddy/changelog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'CodeBuddy IDE 版本更新', link, item: parseChangelog(await fetchProductHtml(link)) }),
};
