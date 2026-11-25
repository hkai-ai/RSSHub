import { load } from 'cheerio';
import pMap from 'p-map';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.novosns.com';
const sitemapUrl = `${baseUrl}/sitemap-news.xml`;

export const parseNovosnsSitemap = (xml: string, limit = 20): Array<{ link: string; pubDate?: Date }> => {
    const entries: Array<{ link: string; lastmod: string }> = [];
    const seen = new Set<string>();
    for (const match of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
        const link = match[1]?.trim();
        const lastmod = match[2]?.trim() || '';
        if (!link || !/^https:\/\/www\.novosns\.com\/news-details\/\d+/.test(link) || seen.has(link)) {
            continue;
        }
        seen.add(link);
        entries.push({ link, lastmod });
    }
    entries.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
    return entries.slice(0, limit).map((entry) => {
        const parsed = entry.lastmod ? parseDate(entry.lastmod) : undefined;
        return {
            link: entry.link,
            pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
        };
    });
};

export const parseNovosnsArticle = (html: string, link: string): { title: string; description: string } => {
    const $ = load(html);
    const rawTitle = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || $('title').first().text().trim();
    const title = rawTitle.replace(/\s*\|\s*novosns\.com\s*$/i, '').trim() || link;
    const bodyHtml = $('article').first().html()?.trim() || $('.am_d3_content, .news-detail, main').first().html()?.trim() || $('meta[name="description"]').attr('content')?.trim() || '';
    return { title, description: bodyHtml };
};

export const route: Route = {
    path: '/news',
    name: '公司新闻',
    categories: ['traditional-media'],
    example: '/novosns/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['novosns.com/company-news', 'novosns.com/'],
            target: '/news',
        },
    ],
    handler: async (ctx) => {
        const limitParam = ctx.req.query('limit');
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
        const xml = await ofetch<string>(sitemapUrl, { parseResponse: (txt) => txt });
        const entries = parseNovosnsSitemap(xml, Number.isFinite(limit) && limit > 0 ? limit : 20);

        if (!entries.length) {
            throw new Error('No Novosns news entries found in sitemap');
        }

        const itemsWithContent: DataItem[] = await pMap(
            entries,
            (entry) =>
                cache.tryGet(`novosns:news:${entry.link}`, async () => {
                    const detailHtml = await ofetch<string>(entry.link, { parseResponse: (txt) => txt });
                    const { title, description } = parseNovosnsArticle(detailHtml, entry.link);
                    return {
                        title,
                        link: entry.link,
                        description,
                        pubDate: entry.pubDate,
                    };
                }),
            { concurrency: 4 }
        );

        return {
            title: '纳芯微电子 - 公司新闻',
            link: `${baseUrl}/`,
            description: '纳芯微电子公司新闻与活动',
            item: itemsWithContent,
            language: 'zh-CN',
        };
    },
};
