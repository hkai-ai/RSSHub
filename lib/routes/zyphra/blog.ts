import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.zyphra.com';
const workUrl = `${baseUrl}/our-work`;

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();

    // Current Astro /our-work layout
    $('a.card.pi-card[href^="/our-work/"], a[href^="/our-work/"]').each((_, el) => {
        const $el = $(el);
        const rawHref = $el.attr('href');
        if (!rawHref) {
            return;
        }
        const url = new URL(rawHref, baseUrl);
        url.search = '';
        if (url.pathname === '/our-work' || url.pathname === '/our-work/') {
            return;
        }

        const title = $el.find('h2, h3, h4').first().text().trim();
        if (!title || items.has(url.href)) {
            return;
        }
        const description = $el.find('p').first().text().trim();
        const tagText = $el.find('span.tag').first().text().replaceAll(/[[\]]/g, '').trim();
        const spans = $el
            .find('span')
            .toArray()
            .map((s) => $(s).text().trim())
            .filter(Boolean);
        const dateText = spans.findLast((text) => /^[A-Z][a-z]+\s+\d{1,2},\s+\d{4}$/.test(text));
        const pubDate = dateText ? parseDate(dateText) : undefined;
        const image = $el.find('img').first().attr('src');

        items.set(url.href, {
            title,
            link: url.href,
            description: description || undefined,
            pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
            category: tagText ? [tagText] : undefined,
            image,
        });
    });

    // Legacy Webflow layout fallback
    if (!items.size) {
        $('.collection-item.w-dyn-item').each((_, el) => {
            const item = $(el);
            const a = item.find('a').first();
            const link = new URL(a.attr('href') || '', baseUrl).href;
            const title = item.find('.heading-main').first().text().trim();
            if (!title) {
                return;
            }
            const description = item.find('.paragraph-main').first().text().trim();
            const dateText = item.find('.text-blog-feature-main').first().text().trim();
            const category = item.find('.topic-main').first().text().trim();
            const author = item.find('.text-blog-feature').first().text().trim();
            const image = item.find('img').first().attr('src');

            items.set(link, {
                title,
                link,
                description,
                pubDate: dateText ? parseDate(dateText) : undefined,
                category: category ? [category] : undefined,
                author: author || undefined,
                image,
            });
        });
    }

    if (!items.size) {
        throw new Error('No Zyphra posts found');
    }

    return [...items.values()];
};

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/zyphra/blog',
    maintainers: ['claude'],
    handler,
    url: 'www.zyphra.com/our-work',
    radar: [
        {
            source: ['www.zyphra.com/our-work', 'www.zyphra.com/blog', 'www.zyphra.com/post/*'],
            target: '/zyphra/blog',
        },
    ],
};

async function handler(ctx) {
    const limit = ctx?.req?.query?.('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 15;
    const response = await ofetch(workUrl, { parseResponse: (txt) => txt });
    const items = parsePosts(response).slice(0, Number.isNaN(limit) ? 15 : limit);

    const itemsWithContent = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                try {
                    const resp = await ofetch(item.link as string, { parseResponse: (txt) => txt });
                    const $detail = load(resp);
                    const content = $detail('article').first().html() || $detail('.rich-text-block').first().html() || $detail('.w-richtext').first().html();
                    if (content) {
                        return { ...item, description: content };
                    }
                } catch {
                    // Keep summary description if detail fetch fails
                }
                return item;
            })
        )
    );

    return {
        title: 'Zyphra Blog',
        link: workUrl,
        description: 'Latest research and posts from Zyphra',
        language: 'en' as const,
        item: itemsWithContent as DataItem[],
    };
}
