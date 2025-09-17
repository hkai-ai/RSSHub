import { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news',
    categories: ['traditional-media'],
    example: '/abajournal/news',
    parameters: {},
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
            source: ['abajournal.com/news'],
            target: '/news',
        },
    ],
    name: 'Latest News',
    maintainers: ['your-username'],
    handler,
};

async function handler() {
    const baseUrl = 'https://abajournal.com';
    const url = `${baseUrl}/news`;

    const response = await ofetch(url);
    const $ = load(response);

    const items = [];

    // 查找带有链接的标题元素
    $('h1 a, h2 a, h3 a, h4 a').each((_, element) => {
        const $link = $(element);
        const title = $link.text().trim();
        let link = $link.attr('href');

        if (!title || !link || title.length < 5) {return;}

        // 确保链接是完整的URL
        if (!link.startsWith('http')) {
            link = link.startsWith('/') ? `${baseUrl}${link}` : `${baseUrl}/${link}`;
        }

        // 查找发布日期
        const $parent = $link.closest('article, li, div, section');
        const dateText =
            $parent.find('time').attr('datetime') || $parent.find('time').text().trim() || $parent.find('.date').text().trim() || $parent.text().match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/)?.[0];

        items.push({
            title,
            link,
            pubDate: dateText ? parseDate(dateText) : new Date(),
            guid: link,
        });
    });

    // 去重并限制数量
    const uniqueItems = [];
    const seenLinks = new Set();

    for (const item of items) {
        if (!seenLinks.has(item.link)) {
            seenLinks.add(item.link);
            uniqueItems.push(item);
        }
    }

    // 获取文章详细内容
    const enrichedItems = await Promise.all(
        uniqueItems.slice(0, 15).map((item) =>
            cache.tryGet(item.link, async () => {
                try {
                    const articleResponse = await ofetch(item.link);
                    const $article = load(articleResponse);

                    // 移除不需要的元素
                    $article('script, style, nav, footer, .advertisement, .ad, .sidebar').remove();

                    // 提取正文内容
                    let content = $article('.article-content').html() || $article('.entry-content').html() || $article('.post-content').html() || $article('article .content').html() || $article('.story-body').html();

                    // 如果没找到特定的内容区域，尝试提取article标签内容
                    if (!content) {
                        const $articleTag = $article('article');
                        if ($articleTag.length) {
                            $articleTag.find('nav, footer, .meta, .share').remove();
                            content = $articleTag.html();
                        }
                    }

                    // 获取更准确的发布日期
                    const articleDate = $article('meta[property="article:published_time"]').attr('content') || $article('meta[name="publishdate"]').attr('content') || $article('time').attr('datetime');

                    if (articleDate) {
                        item.pubDate = parseDate(articleDate);
                    }

                    // 获取作者信息
                    const author = $article('meta[name="author"]').attr('content') || $article('.author').text().trim() || $article('.byline').text().trim();

                    if (author) {
                        item.author = author;
                    }

                    // 获取分类
                    const category = $article('meta[property="article:section"]').attr('content') || $article('.category').text().trim();

                    if (category) {
                        item.category = category;
                    }
                } catch {
                    // Silently handle fetch errors
                }

                return item;
            })
        )
    );

    return {
        title: 'ABA Journal - Latest News',
        link: url,
        description: 'Latest news from the American Bar Association Journal',
        item: enrichedItems.filter((item) => item.title && item.link),
        language: 'en',
    };
}
