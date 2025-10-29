import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
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

            const items: DataItem[] = await Promise.all(
                $('.item.card-listing-item')
                    .toArray()
                    .slice(0, limit)
                    .map(async (el) => {
                        const $el = $(el);

                        // Find the main link
                        const linkEl = $el.find('a').first();
                        const href = linkEl.attr('href') ?? '';
                        const fullLink = href.startsWith('http') ? href : `https://imanage.com${href}`;

                        // Get title
                        const title = $el.find('.heading.sm.c2-heading').text().trim();

                        // Get description if available
                        const description = $el.find('.text.c2-text').text().trim();

                        // Fetch individual article page to determine type and extract more info
                        const articleData = await cache.tryGet(fullLink, async () => {
                            try {
                                const articleResponse = await ofetch(fullLink);
                                const $$ = load(articleResponse);

                                // Check if this is coverage by looking for "Coverage" in secondary heading
                                const secondaryHeading = $$('.secondary-heading.lg.c2-secondary-heading').text().trim();
                                const isCoverage = secondaryHeading.toLowerCase().includes('coverage');

                                // Extract external link for coverage articles
                                let externalLink = null;
                                if (isCoverage) {
                                    // Look for various button text patterns
                                    const coverageBtn = $$('a.btn').filter((_, el) => {
                                        const btnText = $$(el).text().toLowerCase();
                                        return btnText.includes('read coverage') || btnText.includes('read news coverage');
                                    });

                                    if (coverageBtn.length) {
                                        externalLink = coverageBtn.attr('href');
                                    }
                                }

                                // Extract publication date
                                const dateText = $$('.meta .date time').text().trim();
                                const pubDate = dateText ? parseDate(dateText) : null;

                                // Extract content
                                const content = isCoverage
                                    ? $$('.text.c2-text').first().html() // For coverage, get the description text
                                    : $$('.text.base-text').first().html(); // For news articles, get the main content

                                return {
                                    isCoverage,
                                    externalLink,
                                    pubDate,
                                    description: content || description,
                                    category: isCoverage ? ['Coverage'] : ['News'],
                                };
                            } catch {
                                return {
                                    isCoverage: false,
                                    externalLink: null,
                                    pubDate: null,
                                    description,
                                    category: ['News'],
                                };
                            }
                        });

                        // For coverage articles, use the external link as the main link if available
                        const finalLink = articleData.isCoverage && articleData.externalLink ? articleData.externalLink : fullLink;

                        return {
                            title,
                            link: finalLink,
                            description: articleData.description,
                            guid: finalLink,
                            pubDate: articleData.pubDate,
                            category: articleData.category,
                            author: articleData.isCoverage ? 'External Coverage' : 'iManage',
                        };
                    })
            );

            // Filter out invalid items
            const validItems = items.filter((item) => item.title && item.link);

            return {
                title: 'iManage News',
                link,
                description: 'Keep updated with the latest iManage news and coverage.',
                item: validItems,
            };
        },
        3600,
        false
    ); // Cache for 1 hour
}
