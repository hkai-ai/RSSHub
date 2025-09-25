import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/blog',
    name: 'ElevenLabs Blog',
    url: 'elevenlabs.io/blog',
    description: 'ElevenLabs Blog - Voice AI research and deployment updates',
    categories: ['programming', 'new-media'],
    example: '/elevenlabs/blog',
    maintainers: ['your-github-username'],
    handler: async () => {
        const baseUrl = 'https://elevenlabs.io';
        const currentUrl = `${baseUrl}/blog`;

        return await cache.tryGet(
            currentUrl,
            async () => {
                const response = await ofetch(currentUrl);
                const $ = load(response);

                const title = $('title').text() || 'ElevenLabs Blog';
                const description = $('meta[name="description"]').attr('content') || 'ElevenLabs Blog - Voice AI research and deployment updates';

                // Extract articles from the blog page
                const articles = [];
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

                    // Get category
                    let category = '';
                    const categoryElement = $article.find('.inline-flex.items-center.justify-center.whitespace-nowrap.rounded-full').first();
                    if (categoryElement.length) {
                        category = categoryElement.text().trim();
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
                        category,
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
            900
        );
    },
};
