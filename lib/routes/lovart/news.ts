import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/:lang?',
    categories: ['new-media'],
    example: '/lovart/news',
    parameters: {
        lang: 'Language code, e.g., `en`, `zh`, `de`, `ru`, `fr`, `ko`, `pt`, `ja`, `it`, `zh-TW`. Default is empty (lets the site decide).',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['lovart.ai/news', 'lovart.ai/*/news'],
            target: '/news',
        },
    ],
    name: 'Lovart Official News',
    maintainers: ['XruiDD'],
    handler,
};

async function handler(ctx: Context) {
    const rootUrl = 'https://www.lovart.ai';
    const lang = ctx.req.param('lang') || '';
    const langPath = lang ? `/${lang}` : '';
    const currentUrl = `${rootUrl}${langPath}/news`;

    return await cache.tryGet(
        currentUrl,
        async () => {
            // 直接 fetch 经常 403，改用带 fallback 的爬虫
            const html = await fetchHtmlWithFallback(currentUrl, {
                fallbackOptions: {
                    waitUntil: 'networkidle',
                    isBanResourceRequest: true,
                },
            });
            const $ = load(html);

            // <article> 仍然存在，但有些情况下也直接以 a 卡片出现，做兼容
            const articles = $('article, a[href*="/news/"][class*="flex"]').toArray();

            const seen = new Set<string>();
            const items = articles
                .slice(0, 30)
                .map((articleElement) => {
                    const $article = $(articleElement);
                    const $a = $article.is('a') ? $article : $article.find('a').first();
                    const href = $a.attr('href') || '';
                    if (!/\/news\/[A-Za-z0-9-]+/.test(href) || /\/news\/?$/.test(href)) {
                        return null;
                    }
                    const link = href.startsWith('http') ? href : `${rootUrl}${href}`;
                    if (seen.has(link)) {
                        return null;
                    }
                    seen.add(link);

                    const title = $article.find('h2, h3').first().text().trim();
                    if (!title) {
                        return null;
                    }

                    const description = $article.find('p.font-sans, p[class*="font-sans"], p[class*="text-secondary-foreground"]').first().text().trim() || title;
                    const dateText = $article.find('p.font-mono, p[class*="font-mono"], time').first().text().trim();
                    const category = $article.find('div.bg-foreground, span.font-mono').first().text().trim();
                    const imageUrl = $article.find('img').first().attr('src');

                    let pubDate: Date | undefined;
                    if (dateText) {
                        const parsed = parseDate(dateText.replaceAll(/\s+/g, ' ').trim(), 'MMM D, YYYY', 'en');
                        if (!Number.isNaN(parsed.getTime())) {
                            pubDate = parsed;
                        }
                    }

                    return {
                        title,
                        link,
                        description,
                        pubDate,
                        category: category ? [category] : undefined,
                        image: imageUrl || undefined,
                    };
                })
                .filter((it): it is NonNullable<typeof it> => it !== null);

            return {
                title: 'Lovart Official News',
                link: currentUrl,
                description: 'Lovart AI Design Tool Official News - Latest product releases, feature updates, and industry insights',
                item: items,
            };
        },
        3600,
        false
    );
}
