import { Route } from '@/types';

import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { config } from '@/config';

export const route: Route = {
    path: '/insights',
    categories: ['new-media'],
    example: '/lexisnexis/insights',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Insights',
    maintainers: ['nczitzk'],
    handler,
    description: 'Get the latest insights and articles from LexisNexis Insights.',
};

async function handler() {
    const rootUrl = 'https://www.lexisnexis.com';
    const currentUrl = `${rootUrl}/community/insights`;

    const items = await cache.tryGet(
        currentUrl,
        async () => {
            const { data: response } = await got(currentUrl, {
                headers: {
                    'User-Agent': config.ua,
                },
            });

            const $ = load(response);

            const articles: any[] = [];

            // Extract articles from tile sections - much more reliable approach
            $('section.tile.gray-light-bg').each((_, element) => {
                const $tile = $(element);

                // Skip promotional tiles (like free trial)
                if ($tile.hasClass('free-trial')) {return;}

                // Find the main article link (with class 'title')
                const $titleLink = $tile.find('a.title');
                if (!$titleLink.length) {return;}

                const link = $titleLink.attr('href');
                const title = $titleLink.text().trim();

                if (!link || !title || title.length < 10) {return;}

                // Get category from button
                let category = '';
                const $categoryBtn = $tile.find('.red-btn, .green-btn, .blue-btn, .orange-btn');
                if ($categoryBtn.length) {
                    category = $categoryBtn.first().text().trim();
                }

                // Get publication date
                let dateText = '';
                const $date = $tile.find('.date');
                if ($date.length) {
                    dateText = $date.first().text().trim();
                }

                // Get image alt text as potential description
                let description = '';
                const $img = $tile.find('img');
                if ($img.length) {
                    const altText = $img.attr('alt');
                    if (altText && altText !== title && altText.length > 20) {
                        description = altText;
                    }
                }

                // Fallback description
                if (!description) {
                    description = `${category}: ${title}`;
                }

                const fullLink = link.startsWith('/') ? `${rootUrl}${link}` : link;

                articles.push({
                    title,
                    link: fullLink,
                    category: category || 'Insights',
                    description,
                    dateText,
                });
            });

            // Process and sort articles
            return articles.slice(0, 15).map((article) => ({
                title: article.title,
                link: article.link,
                description: article.description,
                category: article.category || 'Insights',
                pubDate: article.dateText ? parseDate(article.dateText) : undefined,
                guid: article.link,
            }));
        },
        300
    );

    return {
        title: 'LexisNexis Insights',
        link: currentUrl,
        description: 'Latest insights, thought leadership, and industry analysis from LexisNexis',
        item: items,
    };
}
