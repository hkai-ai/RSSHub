import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news',
    categories: ['programming'],
    example: '/innoscience/news',
    name: 'News',
    maintainers: ['claude'],
    handler,
    radar: [
        {
            source: ['innoscience.com/news', 'innoscience.com/news/press-releases', 'innoscience.com'],
            target: '/news',
        },
    ],
};

async function handler(): Promise<Data> {
    const baseUrl = 'https://www.innoscience.com';
    const listUrl = `${baseUrl}/news/press-releases`;

    const html = await fetchHtmlWithFallback(listUrl);
    const $ = load(html);

    const candidates = $('a[href*="/news/press-releases/"], a[href*="/news/customer-stories/"]')
        .toArray()
        .map((el) => {
            const $a = $(el);
            const href = $a.attr('href') || '';
            // 跳过分页 / 列表自身链接
            if (!/\/news\/(press-releases|customer-stories)\/\d+/.test(href) && !/\/news\/(press-releases|customer-stories)\/[a-z0-9-]+$/i.test(href)) {
                return null;
            }
            const title = ($a.find('h3, h4, h2').first().text() || $a.attr('title') || $a.text()).trim();
            if (!title) {
                return null;
            }

            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const image = $a.find('img').first().attr('src') || $a.find('img').first().attr('data-src');
            const dateText =
                $a
                    .find('*')
                    .toArray()
                    .map((node) => $(node).text().trim())
                    .find((t) => /^[A-Za-z]{3}\s+\d{1,2},\s*\d{4}$/.test(t)) || '';
            const category = $a.find('.category, [class*="category"], [class*="tag"]').first().text().trim();

            return {
                title,
                link,
                pubDate: dateText ? parseDate(dateText, 'MMM D, YYYY', 'en') : undefined,
                category: category ? [category] : undefined,
                image: image ? (image.startsWith('http') ? image : `${baseUrl}${image}`) : undefined,
            };
        })
        .filter((it): it is { title: string; link: string; pubDate?: Date; category?: string[]; image?: string } => it !== null);

    // 去重
    const uniqueItems = [...new Map(candidates.map((it) => [it.link, it])).values()];

    const items: DataItem[] = await Promise.all(
        uniqueItems.map((item) =>
            cache.tryGet(item.link, async () => {
                try {
                    const detailHtml = await fetchHtmlWithFallback(item.link);
                    const $detail = load(detailHtml);
                    const description = $detail('article, .article-content, .news-content, [class*="content"], main').first().html()?.trim() || $detail('meta[name="description"]').attr('content') || item.title;
                    return {
                        title: item.title,
                        link: item.link,
                        description,
                        pubDate: item.pubDate,
                        category: item.category,
                        image: item.image,
                    } as DataItem;
                } catch {
                    return {
                        title: item.title,
                        link: item.link,
                        description: item.title,
                        pubDate: item.pubDate,
                        category: item.category,
                        image: item.image,
                    } as DataItem;
                }
            })
        )
    );

    return {
        title: 'Innoscience - News',
        link: listUrl,
        description: 'Latest news from Innoscience Technology',
        language: 'en',
        item: items,
    };
}
