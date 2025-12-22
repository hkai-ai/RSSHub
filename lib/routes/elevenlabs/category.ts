import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog/category/:category',
    name: 'ElevenLabs Blog Category',
    url: 'elevenlabs.io/blog/category',
    description: 'ElevenLabs Blog posts filtered by category',
    categories: ['programming', 'new-media'],
    example: '/elevenlabs/blog/category/company',
    parameters: {
        category: {
            description: 'Category name (e.g., company, product, developer, etc.)',
        },
    },
    maintainers: ['your-github-username'],
    handler: async (ctx) => {
        const baseUrl = 'https://elevenlabs.io';
        const { category } = ctx.req.param();
        const currentUrl = `${baseUrl}/blog/category/${category}`;

        return await cache.tryGet(
            currentUrl,
            async () => {
                const response = await ofetch(currentUrl);
                const $ = load(response);

                const title = $('title').text() || `ElevenLabs Blog - ${category.charAt(0).toUpperCase() + category.slice(1)}`;
                const description = $('meta[name="description"]').attr('content') || `ElevenLabs Blog posts in ${category} category`;

                // Extract articles from the category page
                const articles: Array<{
                    title: string;
                    link: string;
                    description: string;
                    author: string;
                    category: string;
                    pubDate?: Date;
                    image: string;
                }> = [];
                $('article.card').each((_, element) => {
                    const $article = $(element);

                    // Get article link - try multiple selectors
                    let link = $article.find('a[href]').first().attr('href');
                    if (!link) {
                        // Try to find link in h2 parent
                        link = $article.find('h2').parent('a').attr('href');
                    }
                    if (!link) {
                        return;
                    }

                    const fullLink = link.startsWith('http') ? link : `${baseUrl}${link}`;

                    // Get title - try multiple selectors
                    let title = $article.find('h2.f-heading-05').text().trim();
                    if (!title) {
                        title = $article.find('h2').first().text().trim();
                    }
                    if (!title) {
                        return;
                    }

                    // Get description
                    const description = $article.find('p.f-description-03').text().trim();

                    // Get author
                    let author = '';
                    const authorElement = $article.find(String.raw`.flex-wrap.gap-2.hidden.lg\:flex span`).first();
                    if (authorElement.length) {
                        author = authorElement.text().trim();
                    }

                    // Get category (should match the requested category)
                    let articleCategory = '';
                    const categoryElement = $article.find('.inline-flex.items-center.justify-center.whitespace-nowrap.rounded-full').first();
                    if (categoryElement.length) {
                        articleCategory = categoryElement.text().trim();
                    }

                    // Get publication date
                    let pubDate: Date | undefined;
                    const timeElement = $article.find('time.f-ui-05.text-light');
                    const dateTime = timeElement.attr('datetime');
                    if (dateTime) {
                        pubDate = parseDate(dateTime);
                    }

                    // Get image
                    let image = '';
                    const imgElement = $article.find('img').first();
                    const imgSrc = imgElement.attr('src');
                    if (imgSrc) {
                        image = imgSrc.startsWith('http') ? imgSrc : `${baseUrl}${imgSrc}`;
                    }

                    articles.push({
                        title,
                        link: fullLink,
                        description,
                        author,
                        category: articleCategory,
                        pubDate,
                        image,
                    });
                });

                // If no date found for any article, try to fetch from individual pages
                const items = await Promise.all(
                    articles.map((article) =>
                        cache.tryGet(article.link, async () => {
                            const item = { ...article };

                            // If no pubDate, fetch from article page
                            if (!item.pubDate) {
                                try {
                                    const articleResponse = await ofetch(item.link);
                                    const $article = load(articleResponse);

                                    // Try to find date in structured data
                                    const structuredData = $article('script[type="application/ld+json"]').text();
                                    if (structuredData) {
                                        try {
                                            const data = JSON.parse(structuredData);
                                            if (Array.isArray(data)) {
                                                const articleData = data.find((item) => item['@type'] === 'Article');
                                                if (articleData?.datePublished) {
                                                    item.pubDate = parseDate(articleData.datePublished);
                                                }
                                            }
                                        } catch {
                                            // Ignore JSON parsing errors
                                        }
                                    }

                                    // Fallback: try to find time element
                                    if (!item.pubDate) {
                                        const timeElement = $article('time[datetime]');
                                        const dateTime = timeElement.attr('datetime');
                                        if (dateTime) {
                                            item.pubDate = parseDate(dateTime);
                                        }
                                    }
                                } catch (error) {
                                    logger.error(`Failed to fetch article details for ${item.link}:`, error);
                                }
                            }

                            return item;
                        })
                    )
                );

                return {
                    title,
                    link: currentUrl,
                    description,
                    item: items,
                };
            },
            900,
            false
        );
    },
};
