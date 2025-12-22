import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';

const handler = async () => {
    const baseUrl = 'https://lovable.dev';
    const targetUrl = `${baseUrl}/blog`;

    let html: string;
    try {
        html = await ofetch(targetUrl, {
            headers: {
                'User-Agent': config.ua,
            },
        });
    } catch (error) {
        logger.error(`Failed to fetch ${targetUrl}:`, error);
        throw new Error('Failed to fetch Lovable blog');
    }

    const $ = load(html);

    const items = $('main > div > main > div')
        .children()
        .toArray()
        .map((element) => {
            const $el = $(element);
            const href = $el.attr('href');
            if (!href) {
                return null;
            }
            const link = new URL(href, baseUrl).href;
            const title = $el.find('h2').first().text().trim();
            const description = $el.find('p.line-clamp-2').first().text().trim();
            const category = $el.find('div.text-sm.text-muted-foreground').first().text().trim();

            // Extract publication date from time element
            const dateTimeAttr = $el.find('time').first().attr('datetime') || $el.find('time').first().attr('dateTime');
            let pubDate: Date | undefined;
            if (dateTimeAttr) {
                const parsedDate = new Date(dateTimeAttr);
                if (!Number.isNaN(parsedDate.getTime())) {
                    pubDate = parsedDate;
                }
            }

            // Extract author if available (optional field)
            const authorSpan = $el.find('div.mt-2 span').first();
            const author = authorSpan.text().trim() || undefined;

            // Extract image
            const imgSrc = $el.find('img').first().attr('src');
            const image = imgSrc ? new URL(imgSrc, baseUrl).href : undefined;
            return {
                title,
                link,
                description,
                category: [category],
                pubDate,
                author,
                ...(image && {
                    image,
                }),
            };
        })
        .filter((ele) => ele !== null);
    return {
        title: 'Lovable Blog',
        link: targetUrl,
        description: 'Latest updates from Lovable - AI-powered design and development platform',
        language: 'en' as const,
        item: items,
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
