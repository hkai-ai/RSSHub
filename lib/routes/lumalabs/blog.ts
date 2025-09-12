import { Route } from '@/types';
import { load } from 'cheerio';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog/:category?',
    categories: ['programming'],
    example: '/lumalabs/blog/news',
    parameters: { category: 'Blog category, defaults to news' },
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
            source: ['lumalabs.ai/blog/:category'],
            target: '/blog/:category',
        },
    ],
    name: 'Blog',
    maintainers: ['claude-code'],
    handler,
};

async function handler(ctx) {
    const category = ctx.req.param('category') || 'news';
    const baseUrl = 'https://lumalabs.ai';
    const url = `${baseUrl}/blog/${category}`;

    const response = await got(url);
    const $ = load(response.data);

    // Extract articles from the grid container
    const articles = $(String.raw`.mx-auto.grid.w-full.grid-cols-1.gap-6.md\:grid-cols-2.lg\:grid-cols-3 > div`)
        .toArray()
        .map((ele) => {
            const item = $(ele);

            // Extract title
            const title = item.find('h3').text().trim();

            // Extract date
            const dateText = item.find('p.mb-2.text-sm.font-medium').text().trim();

            // Extract description
            const description = item
                .find(String.raw`.text-sm.text-black\/70 div p`)
                .text()
                .trim();

            // Extract link from the "Read article" link
            const relativeLink = item.find('a[href^="/blog/news/"]').attr('href');
            const link = relativeLink ? `${baseUrl}${relativeLink}` : '';

            // Extract image
            const img = item.find('img');
            const image = img.attr('src') || '';

            if (!title || !link) {
                return null;
            }

            return {
                title,
                link,
                description: description || title,
                pubDate: parseDate(dateText),
                category,
                image: image.startsWith('http') ? image : `${baseUrl}${image}`,
            };
        })
        .filter(Boolean);

    return {
        title: `Luma Labs - ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        link: url,
        description: 'Get the latest Luma AI news, updates, and innovations. Stay informed on new features, AI advancements, and industry trends in video and 3D creation.',
        item: articles,
    };
}
