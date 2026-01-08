import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news/:category?',
    name: 'News',
    categories: ['new-media'],
    example: '/sumida/news',
    parameters: {
        category: 'News category ID, optional. Can be 1 (Company News), 2 (Events), 3 (Product News), 4 (Investor News), 22 (CSR News). Default: all news',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['sumida.com/news/', 'sumida.com/news/index.php'],
            target: '/news',
        },
    ],
    maintainers: ['nczitzk'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const baseUrl = 'https://www.sumida.com';
        const listUrl = category ? `${baseUrl}/news/index.php?categoryId=${category}` : `${baseUrl}/news/index.php?viewall=true`;

        const response = await ofetch(listUrl);
        const $ = load(response);

        const categoryMap: Record<string, string> = {
            '1': 'Company News',
            '2': 'Events',
            '3': 'Product News',
            '4': 'Investor News',
            '22': 'CSR News',
        };

        const items: DataItem[] = await Promise.all(
            $('.newsItem')
                .toArray()
                .slice(0, 20)
                .map((element) => {
                    const $item = $(element);
                    const $header = $item.find('.newsHeader');
                    const $content = $item.find('.newsContent');

                    const title = $header.find('h3 a').text().trim();
                    const relativeLink = $header.find('h3 a').attr('href');
                    const link = relativeLink ? `${baseUrl}/news/${relativeLink}` : '';

                    // Extract and parse date
                    let dateText = $header.find('span').html() || '';
                    // Handle event dates with post date
                    if (dateText.includes('Post Date:')) {
                        const postDateMatch = dateText.match(/Post Date:\s*([^)]+)/);
                        if (postDateMatch) {
                            dateText = postDateMatch[1];
                        }
                    }
                    // Remove HTML tags and clean up
                    dateText = dateText.replaceAll(/<[^>]*>/g, '').trim();
                    // Remove ordinal suffixes (st, nd, rd, th)
                    dateText = dateText.replaceAll(/(\d+)(st|nd|rd|th)/g, '$1');

                    let pubDate: Date | undefined;
                    try {
                        pubDate = timezone(parseDate(dateText, 'MMMM D YYYY', 'en'), 0);
                    } catch {
                        pubDate = undefined;
                    }

                    // Extract tags/categories
                    const tags = $header
                        .find('.newsTags a')
                        .toArray()
                        .map((tag) => $(tag).text().trim())
                        .filter((tag) => tag.length > 0);

                    const description = $content.find('p').first().text().trim();

                    return cache.tryGet(link, async () => {
                        // Fetch full article content
                        let fullDescription = description;
                        if (link && relativeLink && !relativeLink.includes('viewall')) {
                            try {
                                const articleResponse = await ofetch(link);
                                const $article = load(articleResponse);
                                const $articleContent = $article('.newsContent');

                                // Get all content paragraphs
                                fullDescription = $articleContent.html() || description;
                            } catch {
                                fullDescription = description;
                            }
                        }

                        return {
                            title,
                            link,
                            description: fullDescription,
                            pubDate,
                            category: tags,
                        };
                    });
                })
        );

        return {
            title: category ? `SUMIDA News - ${categoryMap[category] || 'Category ' + category}` : 'SUMIDA News - All News',
            link: listUrl,
            description: 'Latest news from SUMIDA Corporation',
            language: 'en',
            item: items,
        } as Data;
    },
};
