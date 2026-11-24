import { load } from 'cheerio';

import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';

const rootUrl = 'https://www.lexisnexis.com';
const currentUrl = `${rootUrl}/community/insights`;

export const parseInsights = (html: string): DataItem[] => {
    const $ = load(html);
    const articles = new Map<string, DataItem>();

    // 1. Current Next.js blog card layout
    $('a[href^="/blog/"], a[href^="https://www.lexisnexis.com/blog/"]').each((_, element) => {
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
            description: category ? `${category}: ${title}` : title,
            category: category ? [category] : ['Insights'],
            pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
            guid: fullLink,
            image,
        });
    });

    // 2. Legacy tile layout fallback
    if (!articles.size) {
        $('section.tile.gray-light-bg').each((_, element) => {
            const $tile = $(element);
            if ($tile.hasClass('free-trial')) {
                return;
            }
            const $titleLink = $tile.find('a.title');
            if (!$titleLink.length) {
                return;
            }
            const link = $titleLink.attr('href');
            const title = $titleLink.text().trim();
            if (!link || !title || title.length < 10) {
                return;
            }
            const category = $tile.find('.red-btn, .green-btn, .blue-btn, .orange-btn').first().text().trim();
            const dateText = $tile.find('.date').first().text().trim();
            const altText = $tile.find('img').attr('alt');
            const description = altText && altText !== title && altText.length > 20 ? altText : `${category}: ${title}`;
            const fullLink = link.startsWith('/') ? `${rootUrl}${link}` : link;

            articles.set(fullLink, {
                title,
                link: fullLink,
                description,
                category: [category || 'Insights'],
                pubDate: dateText ? parseDate(dateText) : undefined,
                guid: fullLink,
            });
        });
    }

    if (!articles.size) {
        throw new Error('No LexisNexis insights articles found');
    }

    return [...articles.values()].slice(0, 15);
};

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
    const response = await fetchHtmlWithFallback(currentUrl, {
        headers: {
            'User-Agent': config.ua,
        },
    });

    return {
        title: 'LexisNexis Insights',
        link: currentUrl,
        description: 'Latest insights, thought leadership, and industry analysis from LexisNexis',
        item: parseInsights(response),
    };
}
