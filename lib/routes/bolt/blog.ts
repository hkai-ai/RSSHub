import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/blog',
    name: 'Bolt Blog',
    categories: ['programming', 'blog'],
    example: '/bolt/blog',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['bolt.new/blog'],
            target: '/bolt/blog',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        try {
            const response = await ofetch('https://bolt.new/blog');

            const $ = load(response);

            // Find all article links with data-framer-name="Desktop"
            const articles: Array<{
                title: string;
                link: string;
                description: string;
                category?: string;
            }> = [];

            $('a[data-framer-name="Desktop"]').each((_, element) => {
                const $article = $(element);
                const link = $article.attr('href');

                if (!link) {
                    return;
                }

                // Extract title from h2 element
                const titleElement = $article.find('h2').first();
                const title = titleElement.text().trim();

                // Extract description from p element
                const descriptionElement = $article.find('p').first();
                const description = descriptionElement.text().trim();

                // Extract category/label from the highlighted element
                const categoryElement = $article.find('[data-highlight="true"] h2');
                const category = categoryElement.text().trim();

                if (title && link) {
                    // Convert relative links to absolute
                    const absoluteLink = new URL(link, 'https://bolt.new').href;
                    if (!articles.some((article) => article.link === absoluteLink)) {
                        articles.push({
                            title,
                            link: absoluteLink,
                            description: description || title,
                            category,
                        });
                    }
                }
            });

            // Fetch detailed information for each article
            const items = await Promise.all(
                articles.map((article) =>
                    cache.tryGet(
                        article.link,
                        async () => {
                            try {
                                const response = await ofetch(article.link);

                                const $ = load(response);

                                // Extract publication date from [data-framer-name="Date"]
                                const dateElement = $('[data-framer-name="Date"]').first();
                                const dateText = dateElement.text().trim();

                                let pubDate: Date | undefined;
                                if (dateText) {
                                    try {
                                        // Parse date like "May 27, 2025"
                                        const parsedDate = parseDate(dateText, 'MMM D, YYYY', 'en');
                                        if (!Number.isNaN(parsedDate.getTime())) {
                                            pubDate = timezone(parsedDate, 0);
                                        }
                                    } catch (error) {
                                        logger.warn(`Failed to parse date "${dateText}" for article "${article.title}":`, error);
                                    }
                                }

                                return {
                                    title: article.title,
                                    link: article.link,
                                    description: article.description,
                                    pubDate,
                                    category: article.category ? [article.category] : undefined,
                                };
                            } catch (error) {
                                logger.error(`Failed to fetch details for article "${article.title}":`, error);
                                // Return basic info if fetching details fails
                                return {
                                    title: article.title,
                                    link: article.link,
                                    description: article.description,
                                    category: article.category ? [article.category] : undefined,
                                };
                            }
                        },
                        60 * 60 * 24 * 7
                    )
                )
            );

            if (items.length === 0) {
                logger.warn('No articles found on Bolt blog page');
            }

            return {
                title: 'Bolt Blog',
                link: 'https://bolt.new/blog',
                description: 'Latest posts from Bolt blog',
                language: 'en',
                item: items,
            };
        } catch (error) {
            logger.error('Error fetching Bolt blog:', error);
            throw new Error('Failed to fetch Bolt blog content');
        }
    },
};
