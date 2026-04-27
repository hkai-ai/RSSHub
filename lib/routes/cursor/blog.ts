import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';

export const handler = async (ctx: Context): Promise<Data> => {
    const { topic, locale } = ctx.req.param();
    const limit: number = Number.parseInt(ctx.req.query('limit') ?? '10', 10);

    const baseUrl = 'https://cursor.com';
    const normalizedTopic = topic === 'all' ? undefined : topic;
    const localeSegment = locale ? `/${locale}` : '';
    const path = normalizedTopic ? `${localeSegment}/blog/topic/${normalizedTopic}` : `${localeSegment}/blog`;
    const targetUrl = new URL(path, baseUrl).href;

    const html = await fetchHtmlWithFallback(targetUrl);
    const $ = load(html);

    const main = $('#main').last(); // there are two main tags before hydration
    const items: DataItem[] = main
        .find('article')
        .toArray()
        .map((el): DataItem | null => {
            const $el = $(el);
            // Cursor 改版后卡片有两种结构：
            //   1) Featured：article 内含 a 链接（早期版式）
            //   2) Standard / 客户故事：a 在 article 外层（<a><article/></a>）
            // 同时 "In the Press" / 视频 / changelog 区块的 article 链接是站外或非
            // 博客路径，需要过滤掉以避免污染 RSS。
            const innerLink = $el.find('a[href]').first();
            const $link = innerLink.length ? innerLink : $el.parent('a[href]');
            const href = $link.attr('href');

            if (!href || /^https?:/i.test(href) || !/\/blog\/[^/]/.test(href)) {
                return null;
            }

            const ps = $el.find('p');
            const title = ps.first().text().trim();
            if (!title) {
                return null;
            }
            const description = ps.eq(1).text().trim();

            const datetime = $el.find('time').first().attr('datetime');
            const pubDate = datetime ? parseDate(datetime.trim()) : undefined;

            return {
                title,
                description,
                pubDate,
                link: new URL(href, baseUrl).href,
            };
        })
        .filter((item): item is DataItem => item !== null)
        .slice(0, limit);

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
