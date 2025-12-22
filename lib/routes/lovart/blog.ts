import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPage } from '@/utils/puppeteer';

export const route: Route = {
    path: '/blog/:lang?',
    categories: ['blog'],
    example: '/lovart/blog',
    parameters: {
        lang: 'Language code, e.g., `en`, `zh`, `de`, `ru`, `fr`, `ko`, `pt`, `ja`, `it`, `zh-TW`. Default is English (`en`)',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
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
            const { page, destory } = await getPuppeteerPage(currentUrl);

            try {
                // Wait for articles to load
                await page.waitForSelector('article', { timeout: 30000 });

                const html = await page.content();
                const $ = load(html);

                // Parse article elements directly
                const articles = $('article').toArray();

                const items = articles.slice(0, 20).map((articleElement) => {
                    const $article = $(articleElement);

                    // Extract data from article structure
                    const title = $article.find('h2').text().trim();
                    const description = $article.find('p.text-secondary-foreground').text().trim();
                    const category = $article.find('div.bg-foreground').text().trim();
                    const dateText = $article.find('time').text().trim();
                    const imageUrl = $article.find('img').attr('src');
                    // Find the parent link for this article
                    const parentLink = $article.parent().attr('href');
                    const link = parentLink ? `${rootUrl}${parentLink}` : '';
                    const pubDate = parseDate(dateText, 'MMMM D, YYYY', 'en');

                    return {
                        title,
                        link,
                        description,
                        pubDate,
                        category: category ? [category] : undefined,
                        image: imageUrl || undefined,
                    };
                });

                // Filter out items without titles (in case parsing failed)
                const validItems = items.filter((item) => item.title);

                return {
                    title: 'Lovart Official Blog',
                    link: currentUrl,
                    description: 'Lovart AI Design Tool Official Blog - Discover new design trends, creative inspiration, and behind-the-scenes stories from Lovart',
                    item: validItems,
                };
            } finally {
                await destory();
            }
        },
        3600,
        false
    );
}
