import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'picture'],
    example: '/ideogram/blog',
    maintainers: ['claude'],
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
    },
    radar: [
        {
            source: ['ideogram.ai/blog', 'ideogram.ai/blog/*'],
            target: '/blog',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://ideogram.ai';
        const blogUrl = `${baseUrl}/features`;

        const items = await cache.tryGet(
            blogUrl,
            async () => {
                const html = await unlockWebsite(blogUrl);
                const $ = load(html);

                const items: Array<{
                    title: string;
                    link: string;
                    description: string;
                    pubDate?: Date;
                    image?: string;
                }> = [];

                const contentDiv = $('[data-framer-name="Content"]').first();
                if (contentDiv.length > 0) {
                    // Find title and link
                    const titleLink = contentDiv.find('a').first();
                    const title = contentDiv.find('h3').first().text().trim();
                    const relativeLink = titleLink.attr('href');
                    const link = relativeLink ? new URL(relativeLink, baseUrl).href : '';

                    // Find date
                    const dateLinks = contentDiv.find('a');
                    let dateText = '';
                    dateLinks.each((_, el) => {
                        const text = $(el).text().trim();
                        // Match date patterns like "Sept 4, 2025"
                        if (/[A-Za-z]+\s+\d{1,2},\s+\d{4}/.test(text)) {
                            dateText = text;
                            return false; // break
                        }
                    });

                    // Find description
                    const descriptionContainer = contentDiv.find('[data-framer-component-type="RichTextContainer"]').last();
                    let description = descriptionContainer.text().trim();
                    // Remove "Read more" text if present
                    description = description.replace(/Read more$/, '').trim();
                    dateText = dateText.replace(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/, (_, mon, day, year) => `${mon.slice(0, 3)} ${day}, ${year}`).trim();
                    // Parse date
                    const pubDate = timezone(parseDate(dateText, 'MMM D, YYYY', 'en'), 0);

                    if (title && link) {
                        items.push({
                            title,
                            link,
                            description: description || title,
                            pubDate,
                        });
                    }
                    contentDiv.remove();
                }

                // Extract historical articles
                // Find all containers with data-framer-name="Content"
                const contentContainers = $('[data-framer-name="Content"]');
                contentContainers.each((_, container) => {
                    const $container = $(container);

                    // Find title and link
                    const titleLink = $container.find('a').first();
                    const title = $container.find('h3').first().text().trim();
                    const relativeLink = titleLink.attr('href');

                    if (!title || !relativeLink) {
                        return;
                    }

                    const link = new URL(relativeLink, baseUrl).href;

                    // Find date
                    const dateElements = $container.find('h3');
                    let dateText = '';
                    dateElements.each((_, el) => {
                        const text = $(el).text().trim();
                        // Match date patterns
                        if (/[A-Za-z]+\s+\d{1,2},\s+\d{4}/.test(text)) {
                            dateText = text;
                            return false; // break
                        }
                    });

                    // Find image - look for nearby image link
                    let image = '';
                    const parentContainer = $container.parent();
                    const imageLink = parentContainer.find('a[data-framer-name="Image"]').first();
                    if (imageLink.length > 0) {
                        const imgElement = imageLink.find('img').first();
                        if (imgElement.length > 0) {
                            image = imgElement.attr('src') || '';
                        }
                    }

                    // Parse date
                    dateText = dateText.replace(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/, (_, mon, day, year) => `${mon.slice(0, 3)} ${day}, ${year}`).trim();
                    // Parse date
                    const pubDate = timezone(parseDate(dateText, 'MMM D, YYYY', 'en'), 0);

                    items.push({
                        title,
                        link,
                        description: title,
                        pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
                        image: image || undefined,
                    });
                });
                return items;
            },
            3600,
            false
        );

        return {
            title: 'Ideogram Blog',
            link: blogUrl,
            description: 'Latest updates and features from Ideogram AI',
            item: items,
            language: 'en',
        } as Data;
    },
};
