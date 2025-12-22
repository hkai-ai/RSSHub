import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const categoryMap: Record<string, string> = {
    posts: '全部',
    sd: '深度',
    kxx: '快讯',
    mrzx: '每日资讯',
    zxwz: '资讯文章',
    yjbg: '研究报告',
    uncategorized: '未分类',
};

export const route: Route = {
    path: '/:category?',
    name: '分类文章',
    categories: ['new-media'],
    example: '/evobserver/posts',
    parameters: {
        category: '分类，默认为 posts（全部），可选：sd（深度）、kxx（快讯）、mrzx（每日资讯）、zxwz（资讯文章）、yjbg（研究报告）、uncategorized（未分类）',
    },
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
            source: ['www.evobserver.com/:category?'],
            target: '/:category?',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx): Promise<Data> => {
        const category = ctx.req.param('category') ?? 'posts';
        const baseUrl = 'http://www.evobserver.com';
        const categoryUrl = `${baseUrl}/${category}`;

        const categoryName = categoryMap[category] || category;

        let html: string;
        try {
            html = await ofetch(categoryUrl);
        } catch (error) {
            logger.error(`Failed to fetch ${categoryUrl}:`, error);
            throw new Error(`Unable to fetch articles from ${categoryUrl}`);
        }

        const $ = load(html);
        const articles: DataItem[] = [];

        $('ul.ajaxposts li.ajaxpost').each((_, element) => {
            const $article = $(element).find('article.post_main');

            // Extract title and link
            const titleLink = $article.find('h2 a');
            const title = titleLink.text().trim();
            const link = titleLink.attr('href');

            if (!title || !link) {
                return;
            }

            // Extract image
            const imgElement = $article.find('a.imgeffect img.thumb');
            const image = imgElement.attr('src') || imgElement.attr('data-original') || '';

            // Extract category
            const categoryElement = $article.find('span.is_category a');
            const articleCategory = categoryElement.text().trim();

            // Extract description/excerpt
            const description = $article.find('div.excerpt').text().trim();

            // Extract author
            const authorElement = $article.find('span.author a');
            const author = authorElement.text().trim();

            // Extract date
            const dateText = $article.find('span.date b').text().trim();
            let pubDate: Date | undefined;

            if (dateText) {
                try {
                    // Parse Chinese date format: "2025年12月19日"
                    pubDate = timezone(parseDate(dateText, 'YYYY年M月D日'), 8);

                    // Validate the parsed date
                    if (Number.isNaN(pubDate.getTime())) {
                        logger.debug(`Invalid date parsed from "${dateText}"`);
                        pubDate = undefined;
                    }
                } catch (error) {
                    logger.debug(`Date parsing error for "${dateText}":`, error);
                    pubDate = undefined;
                }
            }

            articles.push({
                title,
                link,
                description,
                author,
                category: articleCategory ? [articleCategory] : undefined,
                pubDate,
                image: image || undefined,
            });
        });

        return {
            title: `电动汽车之家 - ${categoryName}`,
            link: categoryUrl,
            description: `电动汽车之家${categoryName}分类文章`,
            language: 'zh-CN',
            item: articles,
        };
    },
};
