import { load } from 'cheerio';

import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPage } from '@/utils/puppeteer';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news-and-features',
    name: 'News and Features',
    categories: ['traditional-media'],
    example: '/tenneco/news-and-features',
    maintainers: ['claude'],
    handler: async () => {
        const baseUrl = 'https://www.tenneco.com';
        const url = `${baseUrl}/news-and-features`;

        const { page, destory } = await getPuppeteerPage(url);
        let html: string;

        try {
            await page.waitForSelector('.cmp-article-list__posts .teaser', { timeout: 30000 });
            html = await page.content();
        } finally {
            await destory();
        }

        const $ = load(html);

        const articles: Array<{
            title: string;
            link: string;
            description: string;
            pubDate: Date;
            category?: string[];
        }> = [];

        $('.cmp-article-list__posts .teaser').each((_, element) => {
            const $element = $(element);
            const $link = $element.find('.article-teaser__action-link');
            const href = $link.attr('href');

            if (!href) {
                return;
            }

            const title = $element.find('.article-teaser__title').text().trim();
            const dateText = $element.find('.article-teaser__pubDate').text().trim();
            const category = $element.find('.article-teaser__category').text().trim().split(',');
            const link = `${baseUrl}${href}`;

            articles.push({
                title,
                link,
                description: category ? `${category}: ${title}` : title,
                pubDate: timezone(parseDate(dateText, 'MMMM DD, YYYY', 'en'), 0),
                category: category || undefined,
            });
        });

        return {
            title: 'Tenneco - News and Features',
            link: url,
            description: 'Latest news and features from Tenneco',
            item: articles,
        };
    },
    radar: [
        {
            source: ['www.tenneco.com/news-and-features'],
            target: '/news-and-features',
        },
    ],
};
