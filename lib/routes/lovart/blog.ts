import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog/:lang?',
    categories: ['blog'],
    example: '/lovart/blog',
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
            source: ['lovart.ai/blog', 'lovart.ai/*/blog'],
            target: '/blog',
        },
    ],
    name: 'Lovart Official Blog',
    maintainers: ['XruiDD'],
    handler,
};

async function handler(ctx: Context) {
    const rootUrl = 'https://www.lovart.ai';
    const lang = ctx.req.param('lang') || '';
    const langPath = lang ? `/${lang}` : '';
    const currentUrl = `${rootUrl}${langPath}/blog`;

    return await cache.tryGet(
        currentUrl,
        async () => {
            // 站点已不再用 <article>，改 a 卡片，直接用 fetchHtmlWithFallback 避免反爬
            const html = await fetchHtmlWithFallback(currentUrl, {
                fallbackOptions: {
                    waitUntil: 'networkidle',
                    isBanResourceRequest: true,
                },
            });
            const $ = load(html);

            const seen = new Set<string>();
            const items = $('a[href*="/blog/"]')
                .toArray()
                .map((linkEl) => {
                    const $a = $(linkEl);
                    const href = $a.attr('href') || '';
                    if (!/\/blog\/[a-zA-Z0-9-]+/.test(href) || /\/blog\/?$/.test(href)) {
                        return null;
                    }
                    if ($a.find('h2, h3').length === 0) {
                        return null;
                    }

                    const link = href.startsWith('http') ? href : `${rootUrl}${href}`;
                    if (seen.has(link)) {
                        return null;
                    }
                    seen.add(link);

                    const title = $a.find('h2, h3').first().text().trim();
                    if (!title) {
                        return null;
                    }
                    const description = $a.find('p.font-sans, p[class*="font-sans"]').first().text().trim() || title;
                    const dateText = $a.find('p.font-mono, p[class*="font-mono"]').first().text().trim();
                    const category = $a.find('span.font-mono, span[class*="font-mono"]').first().text().trim();
                    const imageUrl = $a.find('img').first().attr('src');

                    let pubDate: Date | undefined;
                    if (dateText) {
                        const parsed = parseDate(dateText.toUpperCase().replaceAll(/\s+/g, ' ').trim(), 'MMM D, YYYY', 'en');
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
                title: 'Lovart Official Blog',
                link: currentUrl,
                description: 'Lovart AI Design Tool Official Blog - Discover new design trends, creative inspiration, and behind-the-scenes stories from Lovart',
                item: items,
            };
        },
        3600,
        false
    );
}
