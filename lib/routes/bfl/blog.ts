import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const ROOT_URL = 'https://bfl.ai';

/**
 * 辅助函数：获取并解析单个博客文章详情页，提取正文内容，并使用缓存。
 */
const fetchDescription = (item: DataItem): Promise<DataItem> =>
    cache.tryGet(item.link!, async () => {
        const detailPageHtml = await ofetch(item.link!);
        const $detailPage = load(detailPageHtml);
        const detailContentSelector = 'div.max-w-4xl.mx-auto.px-6, div.max-w-3xl.mx-auto.px-6, article, .blog-content';
        const fullDescription = $detailPage(detailContentSelector).html()?.trim();

        return {
            ...item,
            description: fullDescription || item.description,
        };
    });

/**
 * 主路由处理函数
 */
async function handler(): Promise<Data> {
    const listPageUrl = `${ROOT_URL}/blog`;

    const listPageHtml = await ofetch(listPageUrl);
    const $ = load(listPageHtml);

    const feedTitle = $('head title').text().trim() || 'BFL AI Blog';
    const feedDescription = $('head meta[name="description"]').attr('content')?.trim() || 'Latest blog posts from Black Forest Labs (bfl.ai).';

    // 尝试多个可能的选择器来获取博客文章列表
    const blogPostSelectors = [
        'div[class*="blog"] a[href^="/blog/"]',
        'a[href^="/blog/"]:has(h2), a[href^="/blog/"]:has(h3), a[href^="/blog/"]:has(h4)',
        'div.grid a[href^="/blog/"], div.flex a[href^="/blog/"]',
        'article a[href^="/blog/"]',
    ];

    let blogLinks = $();
    for (const selector of blogPostSelectors) {
        blogLinks = $(selector);
        if (blogLinks.length > 0) {
            break;
        }
    }

    // 从列表页初步提取每个条目的信息
    const preliminaryItems: DataItem[] = blogLinks
        .toArray()
        .map((anchorElement) => {
            const $anchor = $(anchorElement);
            const $container = $anchor.closest('div, article');

            const relativeLink = $anchor.attr('href');
            const link = relativeLink ? `${ROOT_URL}${relativeLink}` : undefined;

            // 尝试多种方式获取标题
            let title = $anchor.find('h1, h2, h3, h4').first().text().trim();
            if (!title) {
                title = $container.find('h1, h2, h3, h4').first().text().trim();
            }
            if (!title) {
                title = $anchor.text().trim();
            }

            // 尝试获取日期
            let pubDate;
            const dateSelectors = ['time', '[class*="date"]', 'span:contains("202")'];
            for (const dateSelector of dateSelectors) {
                const $timeElement = $container.find(dateSelector).first();
                if ($timeElement.length > 0) {
                    const datetimeAttr = $timeElement.attr('datetime');
                    const timeText = $timeElement.text().trim();
                    if (datetimeAttr) {
                        pubDate = parseDate(datetimeAttr);
                        break;
                    } else if (timeText && /\d{4}|\w+\s+\d{1,2}/.test(timeText)) {
                        pubDate = parseDate(timeText);
                        break;
                    }
                }
            }

            // 尝试获取摘要
            const summarySelectors = ['p[class*="summary"]', 'p[class*="excerpt"]', 'p[class*="description"]', 'div[class*="summary"] p', 'p:not(:empty)'];
            let summaryDescription = '';
            for (const summarySelector of summarySelectors) {
                const summary = $container.find(summarySelector).first().html()?.trim();
                if (summary && summary.length > 10) {
                    summaryDescription = summary;
                    break;
                }
            }

            const author = 'Black Forest Labs';

            // 只有包含有效标题和链接的条目才被认为是初步有效的
            if (!title || !link || title.length < 3) {
                return null;
            }

            // 构造初步的 item 对象
            const preliminaryItem: DataItem = {
                title,
                link,
                description: summaryDescription,
                author,
            };

            if (pubDate) {
                preliminaryItem.pubDate = pubDate.toUTCString();
            }

            return preliminaryItem;
        })
        .filter((item): item is DataItem => item !== null && item.link !== undefined);

    // 如果没有找到文章，返回空的 feed
    if (preliminaryItems.length === 0) {
        return {
            title: feedTitle,
            link: listPageUrl,
            description: feedDescription,
            item: [],
            language: 'en',
        };
    }

    // 并行获取所有文章的完整描述
    const items: DataItem[] = await Promise.all(preliminaryItems.map((item) => fetchDescription(item)));

    return {
        title: feedTitle,
        link: listPageUrl,
        description: feedDescription,
        item: items,
        language: 'en',
    };
}

/**
 * 定义并导出RSSHub路由对象
 */
export const route: Route = {
    path: '/blog',
    categories: ['multimedia'],
    example: '/bfl/blog',
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
            source: ['bfl.ai/blog'],
            target: '/blog',
            title: 'Blog',
        },
    ],
    name: 'Blog',
    maintainers: ['thirteenkai'],
    handler,
    url: 'bfl.ai/blog',
    description: 'Fetches the latest blog posts from Black Forest Labs (bfl.ai). Provides full article content by default with caching.',
};
