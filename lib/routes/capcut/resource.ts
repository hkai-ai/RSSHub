import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import logger from '@/utils/logger';
import cache from '@/utils/cache';
import { config } from '@/config';

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
                    const response = await ofetch(url, {
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
                    const templateData = jsonData.loaderData?.$?.template?.defaultArchive;

                    if (!templateData) {
                        throw new Error('Could not find template data in JSON');
                    }

                    const items: Array<{
                        title: string;
                        link: string;
                        description: string;
                        pubDate?: Date;
                        category?: string;
                        author: string;
                    }> = [];

                    // Process firstShowPageList (direct array)
                    if (templateData.firstShowPageList && Array.isArray(templateData.firstShowPageList)) {
                        for (const article of templateData.firstShowPageList) {
                            if (article && article.title) {
                                items.push({
                                    title: article.title,
                                    link: `${baseUrl}${article.path}`,
                                    description: article.description || '',
                                    author: 'CapCut',
                                    category: category || 'resource',
                                });
                            }
                        }
                    }

                    // Process recommendPageList (nested arrays)
                    if (templateData.recommendPageList && Array.isArray(templateData.recommendPageList)) {
                        for (const pageArray of templateData.recommendPageList) {
                            if (Array.isArray(pageArray)) {
                                for (const article of pageArray) {
                                    if (article && article.title) {
                                        items.push({
                                            title: article.title,
                                            link: `${baseUrl}${article.path}`,
                                            description: article.description || '',
                                            author: 'CapCut',
                                            category: category || 'resource',
                                        });
                                    }
                                }
                            }
                        }
                    }

                    // Remove duplicates based on link
                    const uniqueItems = items.filter((item, index, self) => index === self.findIndex((t) => t.link === item.link));

                    // Fetch detailed metadata for each article
                    const itemsWithMetadata = await Promise.all(
                        uniqueItems.map(
                            (item) =>
                                cache.tryGet(
                                    `capcut:article:${item.link}`,
                                    async () => {
                                        try {
                                            const articleResponse = await ofetch(item.link, {
                                                headers: {
                                                    'User-Agent': config.ua,
                                                },
                                            });

                                            const $article = load(articleResponse);
                                            const articleScriptTag = $article('#__MODERN_ROUTER_DATA__');

                                            if (articleScriptTag.length) {
                                                const articleJsonData = JSON.parse(articleScriptTag.text());
                                                const articleData = articleJsonData.loaderData?.$?.article;

                                                if (articleData) {
                                                    const updatedAt = articleData.updatedAt;
                                                    const pubDate = updatedAt ? new Date(Number(updatedAt) * 1000) : undefined;

                                                    return {
                                                        ...item,
                                                        description: articleData.schema?.templateConfig?.description || item.description,
                                                        pubDate,
                                                        category: articleData.tags?.[0]?.name || item.category,
                                                    };
                                                }
                                            }

                                            return item;
                                        } catch (error) {
                                            logger.error(`Error fetching article metadata for ${item.link}: ${error}`);
                                            return item;
                                        }
                                    },
                                    2_592_000
                                ) // 30 days cache for individual articles
                        )
                    );

                    return {
                        title: category ? `CapCut ${category} Resources` : 'CapCut Resources',
                        link: url,
                        description: category ? `Latest CapCut ${category} articles and resources` : 'Latest CapCut articles and resources for video editing',
                        item: itemsWithMetadata,
                    };
                } catch (error) {
                    logger.error(`Error fetching CapCut resource feed: ${error}`);
                    throw error;
                }
            },
            1800,
            false
        ); // 30 minutes cache for main feed
    },
};
