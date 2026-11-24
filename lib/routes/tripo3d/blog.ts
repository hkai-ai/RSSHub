import { load } from 'cheerio';
import type { Context } from 'hono';

import type { DataItem, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import { parseDate } from '@/utils/parse-date';

const link = 'https://www.tripo3d.ai/blog';

export const parsePosts = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('article.featured-article, main a.group[href^="/blog/"]').toArray()) {
        const card = $(element);
        const href = card.is('a') ? card.attr('href') : card.find('h2 a').attr('href');
        const title = card.find('h2, span.text-4').first().text();
        const date = card
            .find('span')
            .toArray()
            .map((span) => $(span).text())
            .find((text) => /· \d{4}\/\d{2}\/\d{2}$/.test(text))
            ?.match(/\d{4}\/\d{2}\/\d{2}$/)?.[0];
        if (!href || !title || !date) {
            continue;
        }
        const url = new URL(href, link).href;
        const pubDate = parseDate(`${date} +0000`, 'YYYY/MM/DD ZZ');
        if (items.has(url) || Number.isNaN(pubDate.getTime())) {
            continue;
        }
        const image = card.find('img').first().attr('src');
        items.set(url, {
            title,
            link: url,
            pubDate,
            description: card.find('p').first().html() || undefined,
            author: card.find('.author-avatar').first().next('span').text() || undefined,
            category: card
                .find('span.rounded-full, div.rounded-full')
                .map((_, tag) => $(tag).text())
                .get(),
            image: image ? new URL(image, link).href : undefined,
        });
    }
    if (!items.size) {
        throw new Error('No Tripo3D blog articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async (ctx: Context) => {
    const category = ctx.req.param('category');
    const items = parsePosts(await unlockWebsite(link));
    return {
        title: category ? `Tripo3D Blog - ${category}` : 'Tripo3D Blog',
        link,
        description: 'Articles, tutorials and the latest trends in 3D and AI from Tripo3D.',
        item: category ? items.filter((item) => item.category?.some((tag) => tag.toLowerCase().includes(category.toLowerCase()))) : items,
    };
};

export const route: Route = {
    path: '/blog/:category?',
    categories: ['programming'],
    example: '/tripo3d/blog',
    parameters: { category: 'Blog category (optional, defaults to all)' },
    features: {
        requireConfig: [
            { name: 'BRIGHTDATA_API_KEY', description: 'Bright Data API key for web unlocker' },
            { name: 'BRIGHTDATA_UNLOCKER_ZONE', description: 'Bright Data zone identifier for web unlocker' },
        ],
        antiCrawler: true,
    },
    radar: [{ source: ['www.tripo3d.ai/blog', 'tripo3d.ai/blog'], target: '/blog' }],
    name: 'Blog',
    maintainers: ['claude-code'],
    handler,
};
