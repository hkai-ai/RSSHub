import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { fetchHtmlByBrowserCrawler, isValidContent } from '@/utils/browser-crawler';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news-releases',
    name: 'News and Insights',
    categories: ['new-media'],
    example: '/gknautomotive/news-releases',
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
            source: ['gknautomotive.com/en/news-and-Insights/news-releases/'],
            target: '/news-releases',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://www.gknautomotive.com';
        const url = `${baseUrl}/en/news-and-Insights/news-releases/`;

        let html: string | null = null;
        try {
            const unlocked = await unlockWebsite(url);
            if (isValidContent(unlocked)) {
                html = unlocked;
            } else {
                logger.warn(`[gknautomotive] Bright Data 返回内容无效，降级到第三方浏览器服务`);
            }
        } catch (error) {
            logger.warn(`[gknautomotive] Bright Data unlock 失败，降级到第三方浏览器服务：${error instanceof Error ? error.message : String(error)}`);
        }

        if (!html) {
            html = await fetchHtmlByBrowserCrawler({
                url,
                waitUntil: 'networkidle',
                isBanResourceRequest: true,
            });
        }

        const $ = load(html);

        const items: DataItem[] = [];

        $('.listitem').each((_, element) => {
            const $element = $(element);
            const $card = $element.find('a.card.type-1');

            // Skip hidden items
            if ($element.css('display') === 'none') {
                return;
            }

            const link = $card.attr('href');
            if (!link) {
                return;
            }

            const title = $card.find('.cnt').text().trim();
            const dateText = $card.find('.date-time').text().trim();
            const category = $card.find('.cat').text().trim();
            const image = $card.find('img').attr('src');

            const fullLink = link.startsWith('http') ? link : `${baseUrl}${link}`;
            const fullImage = image && !image.startsWith('http') ? `${baseUrl}${image}` : image;

            items.push({
                title,
                link: fullLink,
                description: fullImage ? `<img src="${fullImage}" alt="${title}"><br>${title}` : title,
                pubDate: timezone(parseDate(dateText, 'DD MMM YYYY', 'en'), 0),
                category: [category],
                image: fullImage,
            });
        });

        return {
            title: 'GKN Automotive - News and Insights',
            link: url,
            description: 'Latest news and insights from GKN Automotive',
            language: 'en',
            item: items,
        };
    },
};
