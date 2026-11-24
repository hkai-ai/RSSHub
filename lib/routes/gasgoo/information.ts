import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://autodata.gasgoo.com';

const categoryMap: Record<string, string> = {
    '1859528391280168214': '重大事件',
    '1859528391280168215': '车企',
    '1859528391280168216': '供应链',
    '1859528391280168217': '智能网联',
    '1859528391280168218': '新能源',
    '1859528391280168219': '新技术',
    '1859528391280168220': '政策',
    '1859528391280168221': '销量',
    '1859528391280168222': '财报',
    '1859528391280168223': '人事',
    '1859528391280168224': '创投',
};

export const parseGasgooArticles = (html: string, categoryName: string): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $('article.information-list-item').each((_, el) => {
        const $item = $(el);
        const $titleLink = $item.find('a.item-title').first();
        const title = $titleLink.text().trim();
        const href = $titleLink.attr('href');
        if (!title || !href) {
            return;
        }
        const link = new URL(href, baseUrl).href;
        if (seen.has(link)) {
            return;
        }
        seen.add(link);

        const description = $item.find('a.item-content, .item-content').first().text().trim();
        const $time = $item.find('time').first();
        const dateStr = ($time.attr('datetime') || $time.text()).trim();
        const pubDate = dateStr ? parseDate(dateStr) : undefined;
        const tags = $item
            .find('.information-list-tags a')
            .toArray()
            .map((a) => $(a).text().trim())
            .filter(Boolean);

        items.push({
            title,
            link,
            description,
            pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
            category: [...new Set([categoryName, ...tags])],
        });
    });

    if (!items.length) {
        throw new Error(`No Gasgoo articles found for ${categoryName}`);
    }

    return items;
};

export const route: Route = {
    path: '/information/:cid?',
    name: '全球汽车产业大数据',
    categories: ['new-media'],
    example: '/gasgoo/information/1859528391280168215',
    parameters: {
        cid: '分类ID，见下表，默认为车企分类',
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
            source: ['autodata.gasgoo.com/zh/information/categories/:cid', 'autodata.gasgoo.com/information/imView/articleList'],
            target: '/information/:cid',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const cid = ctx.req.param('cid') || '1859528391280168215';
        const categoryName = categoryMap[cid] || '车企';
        const url = `${baseUrl}/zh/information/categories/${cid}`;

        const html = await ofetch(url);
        const items = parseGasgooArticles(html, categoryName);

        return {
            title: `盖世汽车 - ${categoryName}`,
            link: url,
            description: `盖世汽车全球汽车产业大数据 - ${categoryName}资讯`,
            item: items,
        };
    },
};
