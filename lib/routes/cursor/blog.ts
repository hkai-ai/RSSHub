import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';

export function parseCursorBlogHtml(html: string, limit = 25, baseUrl = 'https://cursor.com'): DataItem[] {
    const $ = load(html);
    const main = $('#main').last();
    const container = main.length ? main : $.root();
    const byUrl = new Map<string, DataItem>();

    container
        .find('article')
        .toArray()
        .forEach((el) => {
            const $el = $(el);
            const innerLink = $el.find('a[href]').first();
            const $link = innerLink.length ? innerLink : $el.parent('a[href]');
            const href = $link.attr('href');

            if (!href || /^https?:/i.test(href) || !/\/blog\/[^/]/.test(href)) {
                return;
            }

            const ps = $el.find('p');
            const headingTitle = $el.find('h1, h2, h3, h4').first().text().trim();
            const title = headingTitle || ps.first().text().trim();
            if (!title) {
                return;
            }
            const description = headingTitle ? ps.first().text().trim() : ps.eq(1).text().trim();

            const datetime = $el.find('time').first().attr('datetime');
            const pubDate = datetime ? parseDate(datetime.trim()) : undefined;
            const link = new URL(href, baseUrl).href;

            const existing = byUrl.get(link);
            if (!existing || (!existing.pubDate && pubDate) || (description && !existing.description)) {
                byUrl.set(link, {
                    title,
                    description: description || existing?.description || title,
                    pubDate: pubDate ?? existing?.pubDate,
                    link,
                });
            }
        });

    return [...byUrl.values()]
        .sort((a, b) => {
            const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return tb - ta;
        })
        .slice(0, limit);
}

export const handler = async (ctx: Context): Promise<Data> => {
    const { topic, locale } = ctx.req.param();
    const limit: number = Number.parseInt(ctx.req.query('limit') ?? '25', 10);

    const baseUrl = 'https://cursor.com';
    const normalizedTopic = topic === 'all' ? undefined : topic;
    const localeSegment = locale ? `/${locale}` : '';
    const path = normalizedTopic ? `${localeSegment}/blog/topic/${normalizedTopic}` : `${localeSegment}/blog`;
    const targetUrl = new URL(path, baseUrl).href;

    const html = await fetchHtmlWithFallback(targetUrl);
    const $ = load(html);
    const items = parseCursorBlogHtml(html, limit, baseUrl);

    return {
        title: $('title').text() || 'Cursor Blog',
        description: $('meta[property="og:description"]').attr('content'),
        link: targetUrl,
        item: items,
        allowEmpty: true,
        image: $('meta[property="og:image"]').attr('content'),
    };
};

export const route: Route = {
    path: '/blog/:topic?/:locale?',
    name: 'Blog',
    url: 'cursor.com',
    maintainers: ['johan456789'],
    example: '/cursor/blog',
    parameters: {
        locale: 'Locale appended to the route path, e.g. `ja`',
        topic: 'Topic: all | product | research | company | news',
    },
    description: undefined,
    categories: ['blog'],
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
            source: ['cursor.com/blog'],
            target: '/blog',
        },
        {
            source: ['cursor.com/blog/topic/:topic'],
            target: '/blog/:topic',
        },
        {
            source: ['cursor.com/:locale/blog'],
            target: '/blog/all/:locale',
        },
        {
            source: ['cursor.com/:locale/blog/topic/:topic'],
            target: '/blog/:topic/:locale',
        },
    ],
    view: ViewType.Articles,
    handler,
};
