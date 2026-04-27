import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import logger from '@/utils/logger';

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

    const $ = load(html);

    // 列表容器：grid 下的所有 <a href="/blog/...">
    const items = $('a[href^="/blog/"]')
        .toArray()
        .filter((el) => {
            const href = $(el).attr('href') || '';
            return href !== '/blog' && href !== '/blog/' && $(el).find('h2').length > 0;
        })
        .map((element) => {
            const $el = $(element);
            const href = $el.attr('href');
            if (!href) {
                return null;
            }
            const link = new URL(href, baseUrl).href;
            const title = $el.find('h2').first().text().trim();
            const description = $el.find('p.line-clamp-2').first().text().trim() || $el.find('p').first().text().trim();

            // 时间元素 datetime 通常为完整时间戳
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
            return {
                title,
                link,
                description: description || title,
                pubDate,
                ...(image && { image }),
            };
        })
        .filter((ele) => ele !== null);

    // 去重（同一篇可能在 grid 中出现多次或导航中重复）
    const uniqueItems = [...new Map(items.map((it) => [it!.link, it!])).values()];

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
