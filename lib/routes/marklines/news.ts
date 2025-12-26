import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/tag/:tag/:slug?',
    name: 'News by Tag',
    categories: ['traditional-media'],
    example: '/marklines/news/tag/769/parts-suppliers',
    parameters: {
        tag: 'Tag ID',
        slug: 'Tag slug (optional)',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['marklines.com/en/news/tag/:tag/:slug?'],
            target: '/news/tag/:tag/:slug?',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const { tag, slug } = ctx.req.param();
        const url = slug ? `https://www.marklines.com/en/news/tag/${tag}/${slug}` : `https://www.marklines.com/en/news/tag/${tag}`;

        let html;
        try {
            html = await ofetch(url);
        } catch (error) {
            logger.error(`Failed to fetch MarkLines news:`, error);
            throw new Error('Failed to fetch news data');
        }

        const $ = load(html);

        const items: DataItem[] = [];

        $('article.simplified-news-card').each((_, element) => {
            const $article = $(element);

            // Extract title and link
            const titleElement = $article.find('.news-title a');
            const title = titleElement.text().trim();
            const relativeLink = titleElement.attr('href');
            const link = relativeLink ? `https://www.marklines.com${relativeLink}` : '';

            // Extract date
            const dateElement = $article.find('time[itemprop="datePublished"]');
            const dateStr = dateElement.attr('datetime');
            const pubDate = dateStr ? parseDate(dateStr) : undefined;

            // Extract country/region
            const country = $article.find('.news-country-label a').text().trim();

            // Extract tags/categories
            const categories: string[] = [];
            $article.find('.tag-group .news-tag a').each((_, tagElement) => {
                const tagText = $(tagElement).text().trim();
                if (tagText) {
                    categories.push(tagText);
                }
            });

            // Add country to categories if available
            if (country) {
                categories.unshift(country);
            }

            // Extract description (news body)
            const newsBody = $article.find('.news-body').text().trim();

            items.push({
                title,
                link,
                description: newsBody || undefined,
                pubDate,
                category: categories.length > 0 ? categories : undefined,
            });
        });

        // Extract page title for feed title
        const pageTitle = $('title').text().trim() || 'MarkLines News';

        const result: Data = {
            title: pageTitle,
            link: url,
            description: `MarkLines automotive industry news - ${pageTitle}`,
            language: 'en',
            item: items,
        };

        return result;
    },
};
