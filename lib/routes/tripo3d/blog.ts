import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import got from '@/utils/got';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/blog/:category?',
    categories: ['programming'],
    example: '/tripo3d/blog',
    parameters: { category: 'Blog category (optional, defaults to all)' },
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
            source: ['www.tripo3d.ai/blog', 'tripo3d.ai/blog'],
            target: '/blog',
        },
    ],
    name: 'Blog',
    maintainers: ['claude-code'],
    handler,
};

async function handler(ctx) {
    const category = ctx.req.param('category');
    const baseUrl = 'https://www.tripo3d.ai';
    const url = `${baseUrl}/blog`;

    const response = await got(url);
    const $ = load(response.data);

    // Extract the big featured news item
    const featuredArticles: DataItem[] = [];
    const featuredItem = $('a > .group').parent();
    if (featuredItem.length > 0 && featuredItem.attr('href')) {
        const title = featuredItem.find('h2').first().text().trim();
        const link = new URL(featuredItem.attr('href')!, url).toString();

        // Extract category/tag (first 1.5rem element)
        const categoryText = featuredItem.find('div.rounded-full[class*="bg-"]').first().text().trim();

        // Extract description - look for the specific description class first
        const description = featuredItem.find('p').text().trim();

        const image = featuredItem.find('img').attr('src');

        let dateStr = '';
        featuredItem.find('span').each((_, el) => {
            const m = $(el)
                .text()
                .match(/^\s*·\s*(\d{4}\/\d{2}\/\d{2})\s*$/);
            if (m) {
                // m[1] 就是 2025/09/26
                dateStr = m[1];
                return false; // 找到一个就停止
            }
        });
        if (title && link) {
            featuredArticles.push({
                title,
                link,
                description: description || title,
                pubDate: timezone(new Date(dateStr), 0),
                category: [categoryText].filter(Boolean),
                image: image?.startsWith('http') ? image : image ? `${baseUrl}${image}` : undefined,
            });
        }
    }

    // Extract regular articles from the grid
    const articles = $('a[href]:not([href=""])[class~="group"]')
        .toArray()
        .map((ele) => {
            const item = $(ele);

            const title = item.find('span.text-4').first().text().trim();
            const link = new URL(item.attr('href')!, url).toString();

            // Find description - it's usually in a div that's not part of the user section
            const description = item.find('p').first().text().trim();

            const image = item.find('img').attr('src');

            // Extract tag/category
            const tagText = featuredItem.find('span.rounded-full').first().text().trim();

            let dateStr = '';
            item.find('span').each((_, el) => {
                const m = $(el)
                    .text()
                    .match(/^\s*·\s*(\d{4}\/\d{2}\/\d{2})\s*$/);
                if (m) {
                    // m[1] 就是 2025/09/26
                    dateStr = m[1];
                    return false; // 找到一个就停止
                }
            });
            if (!title || !link) {
                return null;
            }

            return {
                title,
                link,
                description: description || title,
                pubDate: timezone(new Date(dateStr), 0),
                category: [tagText].filter(Boolean),
                image: image?.startsWith('http') ? image : image ? `${baseUrl}${image}` : undefined,
            };
        })
        .filter(Boolean);

    const map = new Map<string, DataItem>();
    for (const a of [...featuredArticles, ...articles]) {
        if (a !== null) {
            map.set(a.link!, a);
        }
    }
    // Combine featured and regular articles
    const allArticles = map
        .entries()
        .toArray()
        .map((e) => e[1]);

    // Filter by category if specified
    const filteredArticles = category ? allArticles.filter((article) => article.category?.some((cat) => cat.toLowerCase().includes(category.toLowerCase()))) : allArticles;

    const feedTitle = category ? `Tripo3D Blog - ${category.charAt(0).toUpperCase() + category.slice(1)}` : 'Tripo3D Blog';

    return {
        title: feedTitle,
        link: url,
        description: 'Uncover insightful articles, tutorials and the latest trends in the realm of 3D, AI and beyond from Tripo3D.',
        item: filteredArticles,
    };
}
