import { load } from 'cheerio';

import type { Data, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const handler = async (): Promise<Data> => {
    const baseUrl = 'https://nijijourney.com';
    const targetUrl = `${baseUrl}/blog`;

    const data: Data = await cache.tryGet(
        targetUrl,
        async () => {
            try {
                const html = await unlockWebsite(targetUrl);

                const $ = load(html);

                const itemList = $(String.raw`section a.border-nijiPrimary\/30`)
                    .toArray()
                    .map((element) => {
                        const $article = $(element);

                        const link = new URL($article.attr('href') || '', baseUrl).href;
                        const title = $article.find('h1.text-nijiPrimary').text().trim();
                        const description = $article.find('p.text-nijiBlack').text().trim();
                        const image = $article.find('img').attr('src') || '';

                        const categories = $article
                            .find('button')
                            .toArray()
                            .map((btn) => $(btn).text().trim())
                            .filter(Boolean);

                        return {
                            title,
                            link,
                            description,
                            image,
                            category: categories,
                        };
                    })
                    .filter((item) => item.title && item.link);

                // Fetch article details to get publication dates
                const items = await Promise.all(
                    itemList.map((item) =>
                        cache.tryGet(
                            item.link,
                            async () => {
                                try {
                                    const articleHtml = await unlockWebsite(item.link);
                                    const $article = load(articleHtml);

                                    // Find the date in the format "Jul 28, 2025"
                                    const dateText = $article('section.max-w-prose p.text-sm.text-nijiBlack').first().text().trim();

                                    let pubDate: Date | undefined;
                                    if (dateText) {
                                        pubDate = timezone(parseDate(dateText, 'MMM DD, YYYY', 'en'), 0);
                                    }

                                    // Extract article content from the second section.max-w-prose
                                    const contentSection = $article('section.max-w-prose').eq(1);
                                    const content = contentSection.html() || item.description;

                                    return {
                                        ...item,
                                        description: content,
                                        pubDate,
                                    };
                                } catch (error) {
                                    logger.error(`Failed to fetch article ${item.link}:`, error);
                                    return item;
                                }
                            },
                            60 * 60 * 24 * 7
                        )
                    )
                );

                return {
                    title: 'niji・journey Blog',
                    link: targetUrl,
                    description: 'Latest updates and guides from niji・journey, the AI anime art generation platform',
                    item: items,
                };
            } catch (error) {
                logger.error(`Failed to fetch ${targetUrl}:`, error);
                throw new Error('Data source unavailable');
            }
        },
        3600,
        false
    );

    return data;
};

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['design', 'blog'],
    example: '/nijijourney/blog',
    url: 'nijijourney.com/blog',
    maintainers: ['your-github-username'],
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
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['nijijourney.com/blog'],
            target: '/blog',
        },
    ],
    handler,
};
