import type { Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
const baseUrl = 'https://www.americanbar.org/groups/law_practice/resources/law-technology-today/';

export const route: Route = {
    path: '/law-technology-today',
    name: 'Law Technology Today',
    categories: ['journal'],
    example: '/americanbar/law-technology-today',
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
    },
    radar: [
        {
            source: ['www.americanbar.org/groups/law_practice/resources/law-technology-today/'],
            target: '/law-technology-today',
        },
    ],
    maintainers: ['DIYgod'],
    handler: async () =>
        await cache.tryGet(
            baseUrl,
            async () => {
                const html = await unlockWebsite(baseUrl);
                const $ = load(html);

                const items = $('.group-microsite-magazine-landing__latest-articles-list__item')
                    .toArray()
                    .map((item) => {
                        const $item = $(item);
                        const $link = $item.find('h3 a, a[target="_self"]');
                        const title = $link.text().trim();
                        const link = $link.attr('href');
                        const pubDateText = $item.find('.item-meta').text().trim();
                        const description = $item.find('.group-microsite-theme__item-description').text().trim() || '';

                        // Extract date from text like "Sep 16, 2025"
                        const dateMatch = pubDateText.match(/([A-Za-z]{3} \d{1,2}, \d{4})/);
                        const pubDate = dateMatch ? parseDate(dateMatch[1]) : new Date();

                        // Extract categories
                        const categoryText = $item.find('.item-topic').text().trim();
                        const categories = categoryText ? categoryText.split(' | ') : [];

                        // Extract image
                        const $img = $item.find('img');
                        const imageUrl = $img.attr('src');

                        return {
                            title,
                            link: link ? (link.startsWith('http') ? link : `https://www.americanbar.org${link}`) : baseUrl,
                            description,
                            pubDate,
                            category: categories,
                            author: 'American Bar Association',
                            image: imageUrl,
                            guid: link || title,
                        };
                    });

                return {
                    title: 'Law Technology Today',
                    link: baseUrl,
                    description: 'Technology strategies from practicing lawyers, technology professionals, and practice management experts.',

                    item: items,
                };
            },
            3600
        ), // 1 hour cache
};
