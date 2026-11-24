import { load } from 'cheerio';

import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';

const rootUrl = 'https://www.lexisnexis.com';
const currentUrl = `${rootUrl}/community/pressroom/b/news`;

export const parsePressroom = (html: string): DataItem[] => {
    const $ = load(html);
    const articles = new Map<string, DataItem>();

    // 1. Current Next.js news card layout
    $('a[href^="/news/"], a[href^="https://www.lexisnexis.com/news/"]').each((_, element) => {
        const $card = $(element);
        const href = $card.attr('href');
        const title = $card.find('h2, h3, h4').first().text().trim();
        if (!href || !title || title.length < 10) {
            return;
        }
        const fullLink = new URL(href, rootUrl).href;
        if (articles.has(fullLink)) {
            return;
        }
        const $time = $card.find('time').first();
        const dateText = ($time.attr('datetime') || $time.text()).trim();
        const pubDate = dateText ? parseDate(dateText) : undefined;
        const category = $card.find('p').first().text().trim();
        const image = $card.find('img').first().attr('src');

        articles.set(fullLink, {
            title,
            link: fullLink,
            description: category ? `${category}: ${title}` : `LexisNexis Press Release: ${title}`,
            category: category ? [category] : undefined,
            pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
            guid: fullLink,
            image,
        });
    });

    // 2. Legacy pressroom layout fallback
    if (!articles.size) {
        $('a').each((_, element) => {
            const link = $(element).attr('href');
            if (link && link.includes('/pressroom/b/news/posts/')) {
                const title = $(element).text().trim();
                if (title && title.length > 10 && !title.includes('Show More') && !title.includes('Load More')) {
                    const fullLink = link.startsWith('/') ? `${rootUrl}${link}` : link;
                    if (!articles.has(fullLink)) {
                        const $parent = $(element).closest('article, .post-item, .content-item, div[class*="post"], div[class*="item"]');
                        const dateText = $parent.find('.date, .published, .post-date').first().text().trim();
                        const descText = $parent.find('p, .excerpt, .description, .summary').first().text().trim();
                        const description = descText && descText !== title && descText.length > 20 ? descText.slice(0, 200) + (descText.length > 200 ? '...' : '') : `LexisNexis Press Release: ${title}`;

                        articles.set(fullLink, {
                            title,
                            link: fullLink,
                            description,
                            pubDate: dateText ? parseDate(dateText) : undefined,
                            guid: fullLink,
                        });
                    }
                }
            }
        });
    }

    if (!articles.size) {
        throw new Error('No LexisNexis pressroom articles found');
    }

    return [...articles.values()].slice(0, 15);
};

export const route: Route = {
    path: '/pressroom',
    categories: ['new-media'],
    example: '/lexisnexis/pressroom',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Press Room',
    maintainers: ['nczitzk'],
    handler,
    description: 'Get the latest news and press releases from LexisNexis Press Room.',
};

async function handler() {
    const response = await fetchHtmlWithFallback(currentUrl, {
        headers: {
            'User-Agent': config.ua,
        },
    });

    return {
        title: 'LexisNexis Press Room',
        link: `${rootUrl}/community/pressroom`,
        description: 'Latest news and press releases from LexisNexis',
        item: parsePressroom(response),
    };
}
