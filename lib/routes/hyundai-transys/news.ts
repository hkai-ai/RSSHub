import { jsonrepair } from 'jsonrepair';

import type { Data, DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/:page?',
    name: 'News',
    categories: ['traditional-media'],
    example: '/hyundai-transys/news',
    parameters: {
        page: 'Page number, default is 1',
    },
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
            source: ['hyundai-transys.com/en/media/news.do'],
            target: '/news',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const apiUrl = 'https://www.hyundai-transys.com/en/media/getWebNews.do';

        let responseText;
        try {
            responseText = await ofetch(apiUrl, {
                method: 'POST',
            });
        } catch (error) {
            logger.error(`Failed to fetch news from HYUNDAI TRANSYS API:`, error);
            throw new Error('Failed to fetch news data');
        }
        // Parse JSON response
        let response;
        try {
            response = JSON.parse(jsonrepair(responseText));
        } catch (error) {
            logger.error('Failed to parse JSON response:', error);
            throw new Error('Invalid JSON response');
        }

        // Extract news data from the 'other' property in the response
        const newsData = response?.other;
        if (!newsData || !Array.isArray(newsData)) {
            logger.error('Invalid response format from API');
            throw new Error('Invalid API response');
        }

        const items: DataItem[] = newsData.map((item) => {
            // Parse date from YYYYMMDD format (e.g., "20251205")
            const dateStr = String(item.showDate).trim();
            const pubDate = parseDate(dateStr, 'YYYYMMDD');

            // Construct article link
            const link = `https://www.hyundai-transys.com/en/media/news-view.do?keyword=&nSeq=${item.id}&Seq=${item.id}`;

            // Build description from subtitle and content
            let description = '';
            if (item.sSubTitle) {
                description += `<p>${item.sSubTitle}</p>`;
            }
            if (item.sContent) {
                description += item.sContent;
            }

            // Add image if available
            if (item.sImg01) {
                const imageUrl = `https://www.hyundai-transys.com/upload/${item.sImg01}`;
                description = `<img src="${imageUrl}" alt="${item.sImgDesc01 || item.sTitle}"><br>${description}`;
            }

            return {
                title: item.sTitle,
                link,
                description,
                pubDate,
                category: item.sType ? [item.sType] : undefined,
                author: item.sUserID,
            };
        });

        const result: Data = {
            title: 'HYUNDAI TRANSYS - News',
            link: 'https://www.hyundai-transys.com/en/media/news.do',
            description: 'Latest news from HYUNDAI TRANSYS',
            language: 'en',
            item: items,
        };

        return result;
    },
};
