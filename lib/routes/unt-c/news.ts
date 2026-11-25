import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const baseUrl = 'https://cn.unt-c.com';

export const parseUntcNews = (html: string): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $('a.niin-case, a[href^="/news/"]').each((_, el) => {
        const $item = $(el);
        const href = $item.attr('href')?.trim();
        if (!href || !/^\/news\/\d+/.test(href)) {
            return;
        }
        const link = new URL(href, baseUrl).href;
        if (seen.has(link)) {
            return;
        }
        const title = $item.find('.niin-case-ri-tit, h3, h2').first().text().replaceAll(/\s+/g, ' ').trim();
        if (!title) {
            return;
        }
        seen.add(link);
        const dateText = $item.find('.niin-case-ri-date').first().text().trim().replaceAll('.', '-');
        const parsed = dateText ? parseDate(dateText) : undefined;
        const pubDate = parsed && !Number.isNaN(parsed.getTime()) ? timezone(parsed, 8) : undefined;
        const imgSrc = $item
            .find('img')
            .toArray()
            .map((img) => $(img).attr('src')?.trim() || '')
            .find((src) => src && !src.includes('d1_img01un') && !src.includes('arrow'));
        const image = imgSrc ? new URL(imgSrc, baseUrl).href : undefined;
        items.push({
            title,
            link,
            description: image ? `<img src="${image}" alt="${title}"><br>${title}` : title,
            pubDate,
        });
    });

    return items;
};

export const route: Route = {
    path: '/news',
    categories: ['new-media'],
    example: '/unt-c/news',
    radar: [
        {
            source: ['cn.unt-c.com/news', 'cn.unt-c.com/html/news/'],
            target: '/news',
        },
    ],
    name: '公司新闻',
    maintainers: ['claude'],
    handler: async () => {
        const url = `${baseUrl}/news`;
        const response = await ofetch<string>(url, { parseResponse: (txt) => txt });
        const items = parseUntcNews(response);
        if (!items.length) {
            throw new Error('No news items found on UNT-C news page');
        }
        return {
            title: '芯联集成 - 公司新闻',
            link: url,
            item: items,
        };
    },
};
