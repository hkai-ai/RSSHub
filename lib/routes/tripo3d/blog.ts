import { Route } from '@/types';
import { load } from 'cheerio';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

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
    const featuredArticles = [];
    const featuredItem = $('a.w-full.rss.big-news-wrapper');
    if (featuredItem.length > 0) {
        const title = featuredItem.find('div[style*="font-size:2.5rem"]').first().text().trim();
        const link = `${baseUrl}${featuredItem.attr('href')}`;

        // Extract category/tag (first 1.5rem element)
        const categoryText = featuredItem.find('div[style*="font-size:1.5rem"]').first().text().trim();

        // Extract description - look for the specific description class first
        let description = featuredItem.find('div.desc').text().trim();

        // If no description found with class, try the fallback method
        if (!description) {
            const descElements = featuredItem.find('div[style*="font-size:1.5rem"]');
            descElements.each((index, element) => {
                const text = $(element).text().trim();
                if (text !== categoryText && text.length > 20) {
                    description = text;
                    return false; // Break the loop
                }
            });
        }

        const image = featuredItem.find('img').attr('src');

        // Extract author and date from the user section
        const userSection = featuredItem.find('.rsc');
        const authorName = userSection.find('div[style*="font-size:1.25rem"]').first().text().trim();
        const dateText = userSection.find('div[style*="font-size:1.25rem"]').last().text().replace('・', '').trim();

        if (title && link) {
            featuredArticles.push({
                title,
                link,
                description: description || title,
                pubDate: parseDate(dateText),
                author: authorName,
                category: [categoryText].filter(Boolean),
                image: image?.startsWith('http') ? image : image ? `${baseUrl}${image}` : undefined,
            });
        }
    }

    // Extract regular articles from the grid
    const articles = $('a.css.news-item')
        .toArray()
        .map((ele) => {
            const item = $(ele);

            const title = item.find('div[style*="font-size:1.375rem"]').text().trim();
            const link = `${baseUrl}${item.attr('href')}`;

            // Find description - it's usually in a div that's not part of the user section
            const descriptionElements = item.find('div[style*="font-size:1.25rem"]');
            let description = '';
            descriptionElements.each((index, element) => {
                const text = $(element).text().trim();
                const parent = $(element).parent();
                // Skip if it's in the user section (.rsc) or if it looks like a date/author
                if (!parent.hasClass('rsc') && !parent.closest('.rsc').length && !text.includes('・') && !/^\d{4}\/\d{2}\/\d{2}$/.test(text) && text.length > 20) {
                    // Description should be longer than author names
                    description = text;
                    return false; // Break the loop
                }
            });
            const image = item.find('img').attr('src');

            // Extract tag/category
            const tagText = item.find('.ccc.tag div').text().trim();

            // Extract author and date
            const userSection = item.find('.rsc').last();
            const authorElements = userSection.find('div[style*="font-size:1.25rem"]');

            // Handle multiple authors - collect all author names before the date
            const authors = [];
            authorElements.each((index, element) => {
                const text = $(element).text().trim();
                // Skip if it contains date format (・YYYY/MM/DD)
                if (!text.includes('・') && text && !/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
                    authors.push(text);
                }
            });

            // Get the date (last element with ・ or date format)
            const dateText = authorElements.last().text().replace('・', '').trim();

            if (!title || !link) {
                return null;
            }

            return {
                title,
                link,
                description: description || title,
                pubDate: parseDate(dateText),
                author: authors.join(', ') || undefined,
                category: [tagText].filter(Boolean),
                image: image?.startsWith('http') ? image : image ? `${baseUrl}${image}` : undefined,
            };
        })
        .filter(Boolean);

    // Combine featured and regular articles
    const allArticles = [...featuredArticles, ...articles];

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
