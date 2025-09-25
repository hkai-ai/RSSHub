import { Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import { load } from 'cheerio';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/insights',
    name: 'Insights Blog',
    categories: ['programming', 'new-media'],
    example: '/gamma/insights',
    parameters: {},
    description: 'Gamma Insights blog',
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
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['gamma.app/insights'],
            target: '/insights',
        },
    ],
    maintainers: ['claude'],
    handler,
};

async function handler() {
    const baseUrl = 'https://gamma.app';
    const insightsUrl = `${baseUrl}/en/insights`;

    return await cache.tryGet(
        insightsUrl,
        async () => {
            // Force English version by using US IP
            const response = await unlockWebsite(insightsUrl, {
                country: 'US',
            });

            const $ = load(response);

            const items: Array<{
                title: string;
                link: string;
                description: string;
                author: string;
                pubDate: Date;
                category: string | string[];
                image: string | undefined;
            }> = [];

            // Track processed articles to avoid duplicates
            const processedLinks = new Set<string>();

            // Use stable selectors based on Chakra UI semantic classes and role attributes
            $('.chakra-linkbox[role="group"]').each((_, element) => {
                try {
                    const $item = $(element);

                    // Extract title from chakra-heading containing chakra-link with chakra-linkbox__overlay
                    const $titleLink = $item.find('.chakra-heading .chakra-link.chakra-linkbox__overlay').first();
                    const title = $titleLink.text().trim();
                    const link = $titleLink.attr('href');

                    if (!title || !link) {return;}

                    // Skip if we've already processed this link
                    const fullLink = link.startsWith('http') ? link : `${baseUrl}${link}`;
                    if (processedLinks.has(fullLink)) {
                        return;
                    }
                    processedLinks.add(fullLink);

                    // Extract date from chakra-text (should be in format like "September 15th, 2025")
                    let pubDate: Date | undefined;
                    $item.find('.chakra-text').each((_, textEl) => {
                        const dateText = $(textEl).text().trim();
                        // Match date patterns like "September 15th, 2025" or "July 29th, 2025"
                        if (/^[A-Z][a-z]+ \d{1,2}[a-z]{2}, \d{4}$/.test(dateText)) {
                            try {
                                // Parse date like "September 15th, 2025"
                                const cleanDate = dateText.replace(/(\d+)(st|nd|rd|th)/, '$1');
                                // Use JavaScript Date constructor which handles "February 4, 2025" format
                                pubDate = new Date(cleanDate);
                                if (Number.isNaN(pubDate.getTime())) {
                                    throw new TypeError('Invalid date');
                                }
                            } catch (error) {
                                logger.error(`Date parsing error for "${dateText}":`, error);
                                pubDate = new Date();
                            }
                            return false; // Break the each loop
                        }
                    });

                    // Extract category from chakra-badge links
                    const categories: string[] = [];
                    $item.find('.chakra-badge').each((_, badgeEl) => {
                        const categoryText = $(badgeEl).text().trim();
                        if (categoryText) {
                            categories.push(categoryText);
                        }
                    });

                    // Extract author from chakra-linkbox containing author link
                    let author = 'Gamma Team';
                    const $authorLink = $item.find('.chakra-linkbox .chakra-link[href*="/insights/author/"]').first();
                    if ($authorLink.length > 0) {
                        author = $authorLink.text().trim();
                    } else {
                        // Fallback: look for "Gamma Team" text in chakra-text
                        $item.find('.chakra-text').each((_, textEl) => {
                            const text = $(textEl).text().trim();
                            if (text === 'Gamma Team') {
                                author = text;
                                return false;
                            }
                        });
                    }

                    // Extract image from chakra-image
                    let image: string | undefined;
                    const $img = $item.find('.chakra-image').first();
                    if ($img.length > 0) {
                        image = $img.attr('src');
                    }

                    // Build description from available info
                    let description = String(title);
                    if (categories.length > 0) {
                        description += `<br><br>Category: ${categories.join(', ')}`;
                    }
                    if (author) {
                        description += `<br>Author: ${author}`;
                    }
                    if (image) {
                        description = `<img src="${image}" alt="${title}"><br><br>${description}`;
                    }

                    items.push({
                        title,
                        link: fullLink,
                        description,
                        author,
                        pubDate: pubDate || new Date(),
                        category: categories.length > 0 ? categories : ['Blog'],
                        image,
                    });
                } catch (error) {
                    logger.error('Error parsing article item:', error);
                }
            });

            return {
                title: 'Gamma Insights',
                link: insightsUrl,
                description: 'Latest insights, updates, and thought leadership from the Gamma team',
                item: items,
            };
        },
        300
    ); // Cache for 5 minutes
}
