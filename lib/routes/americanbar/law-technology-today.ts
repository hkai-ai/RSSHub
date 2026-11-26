import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.americanbar.org/groups/law_practice/resources/law-technology-today/';

export const parseLawTechnologyToday = (html: string): DataItem[] => {
    const $ = load(html);

    const legacyItems = $('.group-microsite-magazine-landing__latest-articles-list__item')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const $link = $item.find('h3 a, a[target="_self"]');
            const title = $link.text().trim();
            const link = $link.attr('href');
            const pubDateText = $item.find('.item-meta').text().trim();
            const description = $item.find('.group-microsite-theme__item-description').text().trim() || '';
            const dateMatch = pubDateText.match(/([A-Za-z]{3} \d{1,2}, \d{4})/);
            const pubDate = dateMatch ? parseDate(dateMatch[1]) : new Date();
            const categoryText = $item.find('.item-topic').text().trim();
            const categories = categoryText ? categoryText.split(' | ') : [];
            const imageUrl = $item.find('img').attr('src');

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
        })
        .filter((it) => it.title.length > 0);

    if (legacyItems.length > 0) {
        return legacyItems;
    }

    // Resilient fallback when ABA updates microsite card class names
    const seen = new Set<string>();
    const fallbackItems: DataItem[] = [];
    $('a[href*="/groups/law_practice/resources/law-technology-today/20"]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href')?.trim();
        if (!href) {
            return;
        }
        const link = href.startsWith('http') ? href : `https://www.americanbar.org${href.startsWith('/') ? '' : '/'}${href}`;
        if (!/\/law-technology-today\/\d{4}\/[^/?#]+/.test(link) || seen.has(link)) {
            return;
        }
        const title = ($a.find('h1, h2, h3, h4').first().text() || $a.text() || $a.attr('title') || '').replaceAll(/\s+/g, ' ').trim();
        if (!title || title.length < 8 || /^(read more|more|learn more)$/i.test(title)) {
            return;
        }
        seen.add(link);

        const card = $a.closest('article, li, .card, .item, div');
        const cardText = card.text().replaceAll(/\s+/g, ' ');
        const dateMatch = cardText.match(/([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/);
        const pubDate = dateMatch ? parseDate(dateMatch[1]) : undefined;
        const description = card.find('p').first().text().replaceAll(/\s+/g, ' ').trim();

        fallbackItems.push({
            title,
            link,
            guid: link,
            description: description || title,
            author: 'American Bar Association',
            ...(pubDate && !Number.isNaN(pubDate.getTime()) ? { pubDate } : {}),
        });
    });

    return fallbackItems.slice(0, 30);
};

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
                const items = parseLawTechnologyToday(html);

                if (items.length === 0) {
                    throw new Error('No articles found on Law Technology Today page');
                }

                return {
                    title: 'Law Technology Today',
                    link: baseUrl,
                    description: 'Technology strategies from practicing lawyers, technology professionals, and practice management experts.',
                    item: items,
                };
            },
            3600,
            false
        ),
};
