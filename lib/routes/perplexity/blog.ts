import { Route } from '@/types';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming', 'new-media'],
    example: '/perplexity/blog',
    parameters: {},
    features: {
        requireConfig: [
            {
                name: 'BRIGHTDATA_API_KEY',
                description: 'Bright Data API key for bypassing anti-bot measures',
            },
            {
                name: 'BRIGHTDATA_UNLOCKER_ZONE',
                description: 'Bright Data zone identifier for web unlocker',
            },
        ],
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['perplexity.ai/hub', 'www.perplexity.ai/hub'],
        },
    ],
    maintainers: [],
    handler: async () => {
        const baseUrl = 'https://www.perplexity.ai';
        const url = `${baseUrl}/hub`;

        const data = await cache.tryGet(
            url,
            async () => {
                const response = await unlockWebsite(url);

                const $ = load(response);
                const items: Array<{
                    title: string;
                    link: string;
                    description: string;
                    author: string;
                    category: string;
                    pubDate?: Date;
                }> = [];

                // Process featured article first
                const featuredCard = $('[data-framer-name="Featured Card"]').first();
                const featuredLink = featuredCard.find('a[href!=""][href]').first();
                if (featuredLink.length > 0) {
                    const href = featuredLink.attr('href');
                    const title = featuredCard.find('h3 a').text().trim();
                    const description = featuredCard.find('[data-framer-component-type="RichTextContainer"]').eq(1).text().trim();

                    if (href && title) {
                        const fullLink = href.startsWith('./hub/') ? `${baseUrl}${href.slice(1)}` : href.startsWith('/') ? `${baseUrl}${href}` : href;

                        // Fetch the article page to extract the publication date
                        let pubDate: Date | undefined;
                        try {
                            const articleHtml = await unlockWebsite(fullLink);
                            const $article = load(articleHtml);

                            const dateContainer = $article("p:contains('Published on')").parent().next();
                            const dateText = dateContainer.text().trim();

                            if (dateText) {
                                pubDate = parseDate(dateText);
                            }
                        } catch (error) {
                            // Log error but continue without date
                            logger.error(`Failed to fetch date for featured article: ${title}`, error);
                        }

                        items.push({
                            title,
                            link: fullLink,
                            description: description || title,
                            author: 'Perplexity',
                            category: 'featured',
                            pubDate,
                        });
                    }
                }

                // Process regular articles from Not Featured container
                const notFeaturedContainer = $('[data-framer-name="Not Featured"]');
                const articleCards = notFeaturedContainer.children();
                articleCards.each((_, element) => {
                    const $card = $(element);
                    const articleLink = $card.find('[href!=""][href]').first();
                    const href = articleLink.attr('href');
                    if (href) {
                        const fullLink = href.startsWith('http') ? href : href.startsWith('/') ? `${baseUrl}${href}` : `${baseUrl}${href.slice(1)}`;
                        if (items.some((item) => item.link === fullLink)) {
                            return;
                        }
                        const title = $card.find('[data-framer-name="Title"]').text().trim() || $card.find('h4').text().trim();
                        const dateElement = $card.find('[data-framer-name="Date"]');
                        const dateText = dateElement.text().trim();

                        let pubDate: Date | undefined;
                        if (dateText) {
                            pubDate = parseDate(dateText);
                        }

                        items.push({
                            title,
                            link: fullLink,
                            description: title,
                            author: 'Perplexity',
                            category: 'blog',
                            pubDate,
                        });
                    }
                });

                return {
                    title: 'Perplexity Blog',
                    link: url,
                    description: 'Latest blog posts from Perplexity AI',
                    item: items,
                };
            },
            300
        );

        return data;
    },
};
