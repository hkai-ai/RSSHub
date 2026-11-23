import { load } from 'cheerio';

import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import logger from '@/utils/logger';

export function parseLovableBlogHtml(html: string, baseUrl = 'https://lovable.dev'): DataItem[] {
    const $ = load(html);
    const byUrl = new Map<string, DataItem>();

    $('a[href^="/blog/"]')
        .toArray()
        .forEach((element) => {
            const $el = $(element);
            const href = $el.attr('href') || '';
            if (!href || href === '/blog' || href === '/blog/') {
                return;
            }
            const title = $el.find('h2, h3').first().text().trim();
            if (!title) {
                return;
            }
            const link = new URL(href, baseUrl).href;
            const description = $el.find('p.line-clamp-2').first().text().trim() || $el.find('p').first().text().trim();

            const dateTimeAttr = $el.find('time').first().attr('datetime');
            let pubDate: Date | undefined;
            if (dateTimeAttr) {
                const parsedDate = new Date(dateTimeAttr);
                if (!Number.isNaN(parsedDate.getTime())) {
                    pubDate = parsedDate;
                }
            }

            const imgSrc = $el.find('img').first().attr('src');
            const image = imgSrc ? new URL(imgSrc, baseUrl).href : undefined;

            const existing = byUrl.get(link);
            if (!existing || (!existing.pubDate && pubDate)) {
                byUrl.set(link, {
                    title,
                    link,
                    description: description || title,
                    pubDate: pubDate ?? existing?.pubDate,
                    ...(image && { image }),
                });
            }
        });

    return [...byUrl.values()].sort((a, b) => {
        const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return tb - ta;
    });
}

const handler = async () => {
    const baseUrl = 'https://lovable.dev';
    const targetUrl = `${baseUrl}/blog`;

    let html: string;
    try {
        html = await fetchHtmlWithFallback(targetUrl, {
            headers: {
                'User-Agent': config.ua,
            },
        });
    } catch (error) {
        logger.error(`Failed to fetch ${targetUrl}:`, error);
        throw new Error('Failed to fetch Lovable blog', { cause: error });
    }

    const uniqueItems = parseLovableBlogHtml(html, baseUrl);

    return {
        title: 'Lovable Blog',
        link: targetUrl,
        description: 'Latest updates from Lovable - AI-powered design and development platform',
        language: 'en' as const,
        item: uniqueItems,
    };
};

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming', 'blog'],
    example: '/lovable/blog',
    url: 'lovable.dev/blog',
    maintainers: [],
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['lovable.dev/blog'],
            target: '/blog',
        },
    ],
    handler,
};
