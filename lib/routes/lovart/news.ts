import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news',
    categories: ['new-media'],
    example: '/lovart/news',
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
            source: ['lovart.ai/news', 'lovart.ai/zh/news'],
        },
    ],
    name: 'Lovart 官方资讯',
    maintainers: ['your-github-username'],
    handler,
};

async function handler() {
    const rootUrl = 'https://www.lovart.ai';
    const currentUrl = `${rootUrl}/zh/news`;

    const response = await got({
        method: 'get',
        url: currentUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
    });

    const $ = load(response.data);

    const items = await Promise.all(
        $('a[href*="/zh/news/"]')
            .slice(0, 20)
            .toArray()
            .map((element) =>
                cache.tryGet($(element).attr('href'), async () => {
                    const article = $(element).find('article').first();
                    const title = article.find('h2').text().trim();
                    const description = article.find('p.text-secondary-foreground').text().trim();
                    const category = article.find('div.bg-foreground').text().trim();
                    const dateText = article.find('time').text().trim();
                    const imageUrl = article.find('img').attr('src');
                    const link = `${rootUrl}${$(element).attr('href')}`;

                    let pubDate;
                    try {
                        // Parse date like "September 5, 2025" or "July 30, 2025"
                        if (dateText) {
                            pubDate = parseDate(dateText, 'MMMM D, YYYY');
                        }
                    } catch {
                        // If date parsing fails, leave pubDate undefined
                    }

                    // Try to get full article content
                    let fullDescription = description;
                    try {
                        const detailResponse = await got({
                            method: 'get',
                            url: link,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            },
                        });
                        const $detail = load(detailResponse.data);

                        // Try to extract main content (adjust selector based on actual page structure)
                        const content = $detail('main article, .article-content, .news-content').first();
                        if (content.length > 0) {
                            fullDescription = content.html() || description;
                        }
                    } catch {
                        // If fetching detail fails, use the summary description
                    }

                    return {
                        title,
                        link,
                        description: fullDescription,
                        pubDate,
                        category: category || undefined,
                        image: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${rootUrl}${imageUrl}`) : undefined,
                    };
                })
            )
    );

    // Filter out items without titles (in case parsing failed)
    const validItems = items.filter((item) => item.title);

    return {
        title: 'Lovart 官方资讯',
        link: currentUrl,
        description: 'Lovart AI 设计工具官方资讯 - 最新产品发布、功能更新和行业资讯',
        item: validItems,
    };
}
