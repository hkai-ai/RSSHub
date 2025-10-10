import { Route } from '@/types';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/changelog',
    name: 'Changelog',
    categories: ['programming', 'new-media'],
    example: '/perplexity/changelog',
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
            source: ['perplexity.ai/changelog', 'www.perplexity.ai/changelog'],
        },
    ],
    maintainers: ['your-github-username'],
    handler: async () => {
        const baseUrl = 'https://www.perplexity.ai';
        const url = `${baseUrl}/changelog`;

        const data = await cache.tryGet(
            url,
            async () => {
                try {
                    const response = await unlockWebsite(url);
                    const $ = load(response);
                    const items: Array<{
                        title: string;
                        link: string;
                        description: string;
                        author: string;
                        category: string;
                        pubDate?: Date;
                        image?: string;
                    }> = [];

                    // Find all changelog entries using stable data attributes
                    const changelogContainer = $('[data-framer-name="Change Log"]');
                    const changelogItems = changelogContainer.find('a[href]');
                    const seenLinks = new Set<string>();
                    const seenTitles = new Set<string>();

                    changelogItems.each((_, element) => {
                        const $item = $(element);
                        const href = $item.attr('href');

                        if (href) {
                            // Extract title from data-framer-name="Title" container
                            const titleElement = $item.find('[data-framer-name="Title"]');
                            const title = titleElement.text().trim();

                            // Extract description from the text content after title
                            const descriptionElement = $item.find('[data-framer-component-type="RichTextContainer"]').not('[data-framer-name="Title"]').not('[data-framer-name="Category"]');
                            let description = '';
                            descriptionElement.each((_, desc) => {
                                const text = $(desc).text().trim();
                                if (text && !/^\d{2}\.\d{2}\.\d{2}$/.test(text) && text !== title && text !== 'See changes') {
                                    description = text;
                                    return false; // Break the loop
                                }
                            });

                            // Extract date from data-framer-name="Category" (which contains the date)
                            const dateElement = $item.find('[data-framer-name="Category"]');
                            const dateText = dateElement.text().trim();

                            let pubDate: Date | undefined;
                            if (dateText && /^\d{2}\.\d{2}\.\d{2}$/.test(dateText)) {
                                try {
                                    // Parse date format MM.DD.YY
                                    const [month, day, year] = dateText.split('.');
                                    const fullYear = Number(`20${year}`); // Convert YY to 20YY
                                    pubDate = new Date(fullYear, Number(month) - 1, Number(day));
                                } catch (error) {
                                    logger.error(`Date parsing error for "${dateText}":`, error);
                                }
                            }

                            // Extract image URL if available
                            const imageElement = $item.find('img[src]');
                            const imageSrc = imageElement.attr('src');
                            let image: string | undefined;
                            if (imageSrc) {
                                image = imageSrc.startsWith('http') ? imageSrc : `https:${imageSrc}`;
                            }

                            // Construct full URL
                            const fullLink = href.startsWith('./changelog/') ? `${baseUrl}${href.slice(1)}` : href.startsWith('/') ? `${baseUrl}${href}` : href.startsWith('http') ? href : `${baseUrl}/changelog/${href}`;

                            // Check for duplicates
                            if (title && fullLink && !seenLinks.has(fullLink) && !seenTitles.has(title)) {
                                seenLinks.add(fullLink);
                                seenTitles.add(title);

                                items.push({
                                    title,
                                    link: fullLink,
                                    description: description || title,
                                    author: 'Perplexity',
                                    category: 'changelog',
                                    pubDate,
                                    image,
                                });
                            }
                        }
                    });

                    // Sort items by date (newest first)
                    items.sort((a, b) => {
                        if (!a.pubDate && !b.pubDate) {
                            return 0;
                        }
                        if (!a.pubDate) {
                            return 1;
                        }
                        if (!b.pubDate) {
                            return -1;
                        }
                        return b.pubDate.getTime() - a.pubDate.getTime();
                    });

                    return {
                        title: 'Perplexity Changelog',
                        link: url,
                        description: 'Latest product updates and feature releases from Perplexity AI',
                        item: items,
                    };
                } catch (error) {
                    logger.error('Failed to fetch Perplexity changelog:', error);
                    throw error;
                }
            },
            3600 * 2
        );

        return data;
    },
};
