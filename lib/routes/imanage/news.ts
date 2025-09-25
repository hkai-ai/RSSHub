import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { Route, DataItem } from '@/types';

export const route: Route = {
    path: '/news',
    categories: ['programming'],
    example: '/imanage/news',
    parameters: {},
    radar: [
        {
            source: ['imanage.com/resources/resource-center/news/', 'imanage.com'],
        },
    ],
    name: 'News',
    maintainers: ['claude-code'],
    handler,
    url: 'imanage.com/resources/resource-center/news/',
};

async function handler(ctx) {
    const link = 'https://imanage.com/resources/resource-center/news/';

    return await cache.tryGet(
        link,
        async () => {
            const response = await ofetch(link);
            const $ = load(response);

            const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20;

            const items: DataItem[] = $('.item.card-listing-item')
                .toArray()
                .slice(0, limit)
                .map((el) => {
                    const $el = $(el);

                    // Find the main link
                    const linkEl = $el.find('a').first();
                    const href = linkEl.attr('href') ?? '';
                    const fullLink = href.startsWith('http') ? href : `https://imanage.com${href}`;

                    // Get title
                    const title = $el.find('.heading.sm.c2-heading').text().trim();

                    return {
                        title,
                        link: fullLink,
                        guid: fullLink,
                    };
                })
                .filter((item) => item.title && item.link);

            return {
                title: 'iManage News',
                link,
                description: 'Keep updated with the latest iManage news.',
                item: items,
            };
        },
        600
    ); // Cache for 10 minutes
}
