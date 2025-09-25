import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { Route, DataItem } from '@/types';

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/imanage/blog',
    parameters: {},
    radar: [
        {
            source: ['imanage.com/resources/resource-center/blog/', 'imanage.com'],
        },
    ],
    name: 'Blog',
    maintainers: ['claude-code'],
    handler,
    url: 'imanage.com/resources/resource-center/blog/',
};

async function handler(ctx) {
    const link = 'https://imanage.com/resources/resource-center/blog/';

    return await cache.tryGet(
        link,
        async () => {
            const response = await ofetch(link);
            const $ = load(response);

            const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20;

            const items: DataItem[] = $('.item.item-blog.card-listing-item')
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

                    // Get description
                    const description = $el.find('.text.c2-text.mb-3.listing-summary-clamp p').text().trim();

                    // Get author information
                    const authorName = $el.find('.author-summary .text.name.c2-text').text().trim();
                    const authorPosition = $el.find('.author-summary .text.position.c2-text').text().trim();

                    let author = '';
                    if (authorName) {
                        author = authorName;
                        if (authorPosition) {
                            author += ` (${authorPosition})`;
                        }
                    }

                    return {
                        title,
                        link: fullLink,
                        description,
                        author,
                        guid: fullLink,
                    };
                })
                .filter((item) => item.title && item.link);

            return {
                title: 'iManage Blog',
                link,
                description: 'Discover new ways to think about knowledge and how best to activate it inside your organization from iManage experts.',
                item: items,
            };
        },
        600
    ); // Cache for 10 minutes
}
