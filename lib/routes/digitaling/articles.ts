import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';

const baseUrl = 'https://www.digitaling.com';

export const parseDigitalingArticles = (html: string): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $('li, .article_list > div, .work_list > div').each((_, el) => {
        const $el = $(el);
        const $anchor = $el.find('h3 a[href*="/articles/"], .con h3 a, a.title[href*="/articles/"]').first();
        const href = $anchor.attr('href')?.trim();
        const title = $anchor.text().trim();
        if (!href || !title) {
            return;
        }
        const link = new URL(href, baseUrl).href;
        if (!/\/articles\/\d+\.html$/.test(link) || seen.has(link)) {
            return;
        }
        seen.add(link);
        const description = $el.find('p').first().text().trim() || undefined;
        items.push({
            title,
            link,
            description,
        });
    });

    if (!items.length) {
        $('a[href*="/articles/"]').each((_, el) => {
            const $a = $(el);
            const href = $a.attr('href')?.trim();
            const title = $a.text().trim();
            if (!href || !title || title.length < 4 || /^\d+$/.test(title)) {
                return;
            }
            const link = new URL(href, baseUrl).href;
            if (!/\/articles\/\d+\.html$/.test(link) || seen.has(link)) {
                return;
            }
            seen.add(link);
            items.push({ title, link });
        });
    }

    return items;
};

export const route: Route = {
    path: '/articles',
    name: '文章列表',
    categories: ['new-media'],
    example: '/digitaling/articles',
    maintainers: ['claude'],
    url: 'www.digitaling.com/articles',
    radar: [
        {
            source: ['www.digitaling.com/articles', 'www.digitaling.com/rss'],
            target: '/articles',
        },
    ],
    handler: async () => {
        const link = `${baseUrl}/articles`;
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseDigitalingArticles(html);
        if (!item.length) {
            throw new Error('No articles found on Digitaling articles page');
        }
        return {
            title: '数英网 DIGITALING - 文章',
            link,
            description: '数英网广告市场营销与创意文章',
            language: 'zh-CN',
            item,
        };
    },
};
