import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const baseUrl = 'https://www.zmjsemi.com';

export const parseZmjsemiNews = (html: string): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $('a.zz-a, a[href*="/news/company_new/"]').each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href')?.trim();
        if (!href || href.startsWith('javascript:') || !href.includes('/news/')) {
            return;
        }
        const link = new URL(href, baseUrl).href;
        if (!/^https?:\/\//.test(link) || seen.has(link)) {
            return;
        }
        const title = $link.find('h3.zz-textb, h3').first().text().replaceAll(/\s+/g, ' ').trim();
        if (!title) {
            return;
        }
        seen.add(link);
        const summary = $link.find('.zz-text').first().text().replaceAll(/\s+/g, ' ').trim();
        const dateText = $link.find('.zz-date span.font20, .zz-date').first().text().trim().replaceAll('.', '-');
        const parsed = dateText ? parseDate(dateText) : undefined;
        const pubDate = parsed && !Number.isNaN(parsed.getTime()) ? timezone(parsed, 8) : undefined;
        const imgSrc = $link.find('.public-img img.zz-img1, img').first().attr('src')?.trim();
        const image = imgSrc ? new URL(imgSrc, baseUrl).href : undefined;
        const description = image ? `<img src="${image}" alt="${title}"><br>${summary || title}` : summary || title;

        items.push({
            title,
            link,
            description,
            pubDate,
            image,
        });
    });

    return items;
};

export const route: Route = {
    path: '/news/:page?',
    name: '新闻资讯',
    categories: ['programming'],
    example: '/zmjsemi/news',
    parameters: {
        page: '页码，默认为 1',
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
            source: ['www.zmjsemi.com/news', 'www.zmjsemi.com/news/:page'],
            target: '/news/:page',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const page = ctx.req.param('page') ?? '1';
        const url = `${baseUrl}/news?page=${page}`;
        const response = await ofetch<string>(url, { parseResponse: (txt) => txt });
        const items = parseZmjsemiNews(response);
        if (!items.length) {
            throw new Error('No news items found on ZMJ Semi news page');
        }
        return {
            title: '真茂佳半导体 - 新闻资讯',
            link: url,
            item: items,
        } as Data;
    },
};
