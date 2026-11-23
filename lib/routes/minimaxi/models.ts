import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';

export function parseMiniMaxBlogHtml(html: string, baseUrl = 'https://www.minimax.io'): DataItem[] {
    const $ = load(html);
    const byUrl = new Map<string, DataItem>();

    $('a[href^="/blog/"], a[href*="minimax.io/blog/"]').each((_, element) => {
        const $a = $(element);
        const rawHref = $a.attr('href')?.trim();
        if (!rawHref) {
            return;
        }
        const link = rawHref.startsWith('http') ? rawHref : new URL(rawHref, baseUrl).href;
        if (/\/blog\/?$/i.test(new URL(link).pathname)) {
            return;
        }

        const headingTitle = $a.find('h1, h2, h3, h4').first().text().replace(/\s+/g, ' ').trim();
        const spanTitle = $a
            .find('span')
            .toArray()
            .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
            .find((t) => t.length > 3 && t !== 'NEW' && !/^Learn More/i.test(t));
        const title = headingTitle || spanTitle || '';
        if (!title) {
            return;
        }

        const timeEl = $a.find('time').first();
        const dateStr = timeEl.attr('datetime')?.trim() || timeEl.text().trim();
        const pubDate = dateStr ? parseDate(dateStr) : undefined;

        const existing = byUrl.get(link);
        if (!existing || (!existing.pubDate && pubDate) || headingTitle.length > (existing.title?.length || 0)) {
            byUrl.set(link, {
                title,
                link,
                description: title,
                pubDate: pubDate ?? existing?.pubDate,
            });
        }
    });

    return [...byUrl.values()].sort((a, b) => {
        const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return tb - ta;
    });
}

export const route: Route = {
    path: '/models',
    name: 'MiniMax 官方技术博客与模型发布',
    url: 'www.minimax.io/blog',
    categories: ['programming'],
    example: '/minimaxi/models',
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
            source: ['www.minimax.io/blog', 'platform.minimaxi.com/docs/release-notes/models', 'www.minimaxi.com/release-notes/models'],
            target: '/models',
        },
    ],
    maintainers: ['DIYgod'],
    handler: async () => {
        const targetUrl = 'https://www.minimax.io/blog';
        const html = await fetchHtmlWithFallback(targetUrl);
        const items = parseMiniMaxBlogHtml(html, 'https://www.minimax.io');

        return {
            title: 'MiniMax Official Blog',
            link: targetUrl,
            description: 'MiniMax official blog and model releases',
            language: 'en' as const,
            item: items,
        };
    },
};
