import { Route } from '@/types';

import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { config } from '@/config';

export const route: Route = {
    path: '/pressroom',
    categories: ['new-media'],
    example: '/lexisnexis/pressroom',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Press Room',
    maintainers: ['nczitzk'],
    handler,
    description: 'Get the latest news and press releases from LexisNexis Press Room.',
};

async function handler() {
    const rootUrl = 'https://www.lexisnexis.com';
    const currentUrl = `${rootUrl}/community/pressroom/b/news`;

    const items = await cache.tryGet(
        currentUrl,
        async () => {
            const { data: response } = await got(currentUrl, {
                headers: {
                    'User-Agent': config.ua,
                },
            });

            const $ = load(response);

            const articles: any[] = [];

            // Extract article links from the news blog page
            $('a').each((_, element) => {
                const link = $(element).attr('href');
                if (link && link.includes('/pressroom/b/news/posts/')) {
                    const title = $(element).text().trim();

                    // Skip empty titles or navigation elements
                    if (title && title.length > 10 && !title.includes('Show More') && !title.includes('Load More')) {
                        const fullLink = link.startsWith('/') ? `${rootUrl}${link}` : link;

                        // Avoid duplicates
                        if (!articles.some((a) => a.link === fullLink)) {
                            const $parent = $(element).closest('article, .post-item, .content-item, div[class*="post"], div[class*="item"]');

                            // Try to find date information near the link
                            let dateText = '';
                            const $dateSpan = $parent.find('.date, .published, .post-date').first();
                            if ($dateSpan.length) {
                                dateText = $dateSpan.text().trim();
                            }

                            // Try to find description/excerpt
                            let description = '';
                            const $desc = $parent.find('p, .excerpt, .description, .summary').first();
                            if ($desc.length) {
                                const descText = $desc.text().trim();
                                if (descText && descText !== title && descText.length > 20) {
                                    description = descText.slice(0, 200) + (descText.length > 200 ? '...' : '');
                                }
                            }

                            articles.push({
                                title,
                                link: fullLink,
                                description: description || `LexisNexis Press Release: ${title}`,
                                dateText,
                            });
                        }
                    }
                }
            });

            // Process and return articles
            return articles.slice(0, 15).map((article) => ({
                title: article.title,
                link: article.link,
                description: article.description,
                pubDate: article.dateText ? parseDate(article.dateText) : undefined,
                guid: article.link,
            }));
        },
        300
    );

    return {
        title: 'LexisNexis Press Room',
        link: `${rootUrl}/community/pressroom`,
        description: 'Latest news and press releases from LexisNexis',
        item: items,
    };
}
