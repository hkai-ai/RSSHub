import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog/:category?',
    categories: ['programming'],
    example: '/lumalabs/blog/news',
    parameters: { category: '保留兼容参数（lumalabs 已统一并入 /news）。' },
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
            source: ['lumalabs.ai/news', 'lumalabs.ai/blog/:category'],
            target: '/blog/:category?',
        },
    ],
    name: 'News',
    maintainers: ['claude-code'],
    handler,
};

async function handler() {
    const baseUrl = 'https://lumalabs.ai';
    // 站点已将原 `/blog/news` 路径迁移到 `/news`
    const url = `${baseUrl}/news`;

    const response = await fetchHtmlWithFallback(url);
    const $ = load(response);

    const articles = $('a.card-link[href^="/news/"]')
        .toArray()
        .map((linkEl) => {
            const $a = $(linkEl);
            const href = $a.attr('href') || '';
            const title = $a.text().trim();
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;

            // 卡片本身在 a 链接的祖先 div 上：grid > div(card)，包含分类、日期、图片。
            const $card = $a.closest('.group, [class*="grid"][class*="auto-rows-min"]');
            const dateText = $card
                .find('span')
                .toArray()
                .map((el) => $(el).text().trim())
                .find((t) => /^[A-Za-z]{3}\s+\d{1,2},\s*\d{4}$/.test(t));
            const categoryText = $card
                .find('span')
                .toArray()
                .map((el) => $(el).text().trim())
                .find((t) => t && t === t.toUpperCase() && t.length < 40);
            const image = $card.find('img').first().attr('src') || $card.find('img').first().attr('data-src');

            if (!title || !link) {
                return null;
            }

            return {
                title,
                link,
                description: title,
                pubDate: dateText ? parseDate(dateText, 'MMM D, YYYY', 'en') : undefined,
                category: categoryText ? [categoryText] : undefined,
                image: image ? (image.startsWith('http') ? image : `${baseUrl}${image}`) : undefined,
            };
        })
        .filter((it): it is NonNullable<typeof it> => it !== null);

    // 去重（同一条新闻可能被多个内部链接指向）
    const uniqueItems = [...new Map(articles.map((it) => [it.link, it])).values()];

    return {
        title: 'Luma Labs - News',
        link: url,
        description: 'Get the latest Luma AI news, updates, and innovations. Stay informed on new features, AI advancements, and industry trends in video and 3D creation.',
        item: uniqueItems,
    };
}
