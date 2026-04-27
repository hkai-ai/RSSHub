import { load } from 'cheerio';

import { config } from '@/config';
import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';

interface CapcutArticleItem {
    title?: string;
    description?: string;
    path?: string;
    publishTime?: string;
    image?: { src?: string; alt?: string };
    themeColor?: string;
}

interface CapcutBlock {
    type?: string;
    data?: {
        title?: string;
        items?: CapcutArticleItem[];
    };
}

export const route: Route = {
    path: '/resource/:category?',
    name: 'Resource Articles',
    categories: ['programming', 'multimedia'],
    example: '/capcut/resource',
    parameters: {
        category: 'Category path (optional), e.g. editing-tips, effects, templates',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    maintainers: ['your-github-username'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');
        const baseUrl = 'https://www.capcut.com';
        const url = category ? `${baseUrl}/resource/${category}` : `${baseUrl}/resource`;

        return await cache.tryGet(
            url,
            async () => {
                try {
                    const response = await fetchHtmlWithFallback(url, {
                        headers: {
                            'User-Agent': config.ua,
                        },
                    });

                    const $ = load(response);
                    const scriptTag = $('#__MODERN_ROUTER_DATA__');
                    if (!scriptTag.length) {
                        throw new Error('Could not find __MODERN_ROUTER_DATA__ script tag');
                    }

                    const jsonData = JSON.parse(scriptTag.text());
                    // 站点已迁移到 `loaderData.$.article.schema.blocks`，旧 `template.defaultArchive` 不再存在。
                    const blocks: CapcutBlock[] = jsonData.loaderData?.$?.article?.schema?.blocks || [];

                    if (blocks.length === 0) {
                        throw new Error('Could not find blocks in JSON');
                    }

                    const items: Array<{
                        title: string;
                        link: string;
                        description: string;
                        pubDate?: Date;
                        category?: string;
                        author: string;
                        image?: string;
                    }> = [];

                    for (const block of blocks) {
                        if (block.type !== 'default:seo:article-cards') {
                            continue;
                        }
                        const blockTitle = block.data?.title;
                        const articles = block.data?.items || [];
                        for (const article of articles) {
                            if (!article || !article.title || !article.path) {
                                continue;
                            }

                            // publishTime 形如 "Feb 2, 2026 · 10 min"
                            let pubDate: Date | undefined;
                            if (article.publishTime) {
                                const datePart = article.publishTime.split('·')[0].trim();
                                const parsed = parseDate(datePart, 'MMM D, YYYY', 'en');
                                if (!Number.isNaN(parsed.getTime())) {
                                    pubDate = parsed;
                                }
                            }

                            items.push({
                                title: article.title,
                                link: `${baseUrl}${article.path}`,
                                description: article.description || article.title,
                                pubDate,
                                category: blockTitle || category || 'resource',
                                author: 'CapCut',
                                image: article.image?.src,
                            });
                        }
                    }

                    // 去重
                    const uniqueItems = [...new Map(items.map((it) => [it.link, it])).values()];

                    return {
                        title: category ? `CapCut ${category} Resources` : 'CapCut Resources',
                        link: url,
                        description: category ? `Latest CapCut ${category} articles and resources` : 'Latest CapCut articles and resources for video editing',
                        item: uniqueItems,
                    };
                } catch (error) {
                    logger.error(`Error fetching CapCut resource feed: ${error}`);
                    throw error;
                }
            },
            1800,
            false
        );
    },
};
