import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import { absoluteProductLinks, fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://muse.ai/blog';

export const parseBlog = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('main a[href^="/blog/"]:has(h2)')
            .toArray()
            .map((element) => ({
                title: $(element).find('h2').text().trim(),
                link: new URL($(element).attr('href')!, link).href,
                description: $(element).find('p').first().html() ?? '',
            })),
        'Muse'
    );
};

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['blog'],
    example: '/muse/blog',
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({
        title: 'Muse Blog',
        link,
        item: await Promise.all(
            parseBlog(await fetchProductHtml(link)).map((item) =>
                cache.tryGet(item.link, async () => {
                    const html = await fetchProductHtml(item.link);
                    const $ = load(html);
                    const main = $('main').first().clone();
                    main.find('h1,nav,footer,script,style').remove();
                    const date = $('meta[property="article:published_time"]').attr('content') ?? $('time').first().attr('datetime');
                    return { ...item, description: absoluteProductLinks($, main.html() ?? item.description, item.link), pubDate: productDate(date) };
                })
            )
        ),
    }),
};
