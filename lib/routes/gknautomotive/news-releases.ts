import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import { fetchHtmlByBrowserCrawler, fetchHtmlWithFallback, isValidContent } from '@/utils/browser-crawler';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';

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
            source: ['gknautomotive.com/en/news-and-media/latest-news-and-insights/', 'gknautomotive.com/en/news-and-Insights/news-releases/'],
            target: '/news-releases',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://www.gknautomotive.com';
        // 旧 URL 已 301 到该新地址
        const url = `${baseUrl}/en/news-and-media/latest-news-and-insights/`;

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
            try {
                html = await fetchHtmlByBrowserCrawler({
                    url,
                    waitUntil: 'networkidle',
                    isBanResourceRequest: true,
                });
            } catch (error) {
                logger.warn(`[gknautomotive] 第三方浏览器服务失败，最终尝试普通 fetch：${error instanceof Error ? error.message : String(error)}`);
                html = await fetchHtmlWithFallback(url);
            }
        }

        const $ = load(html);

        const items: DataItem[] = [];

        // 新结构：链接卡片同时承担容器与跳转职能，class 为 a.card-news / a.card-insight
        $('a.card-news, a.card-insight').each((_, element) => {
            const $card = $(element);
            const href = $card.attr('href');
            if (!href) {
                return;
            }
            const title = $card.find('h2.h4, h2, h3').first().text().trim();
            if (!title) {
                return;
            }
            const dateText = $card.find('.card-date, li.card-date').first().text().trim();
            const category = $card.find('.card-type, li.card-type').first().text().trim() || ($card.hasClass('card-news') ? 'News' : 'Insight');
            const image = $card.find('img').attr('src');

            const fullLink = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const fullImage = image && !image.startsWith('http') ? `${baseUrl}${image}` : image;

            // 日期格式 "Wed 12 Nov 2025" -> 取后三段后用 "DD MMM YYYY"
            let pubDate: Date | undefined;
            const datePart = dateText.replace(/^[A-Za-z]{3}\s+/, '');
            if (datePart) {
                const parsed = parseDate(datePart, 'D MMM YYYY', 'en');
                if (!Number.isNaN(parsed.getTime())) {
                    pubDate = parsed;
                }
            }

            items.push({
                title,
                link: fullLink,
                description: fullImage ? `<img src="${fullImage}" alt="${title}"><br>${title}` : title,
                pubDate,
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
