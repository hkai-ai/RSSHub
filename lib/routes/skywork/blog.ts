import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://skywork.ai/blog';
export const parseBlog = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('main a[href^="/blog/"]:has(h2)')
            .toArray()
            .map((element) => ({
                title: $(element).find('h2').text().trim(),
                link: new URL($(element).attr('href')!, link).href,
                description: $(element).find('p').first().html() ?? '',
                pubDate: productDate($(element).find('time').attr('datetime') ?? $(element).text()),
            })),
        'Skywork'
    );
};
export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['blog'],
    example: '/skywork/blog',
    maintainers: ['hkai-ai'],
    description: 'Official blog including tutorials and product use cases; not exclusively release announcements.',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'Skywork Blog', link, item: parseBlog(await fetchProductHtml(link)) }),
};
