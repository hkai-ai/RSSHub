import type { Route } from '@/types';
import cache from '@/utils/cache';
import { getPuppeteerPage } from '@/utils/puppeteer';
import { load } from 'cheerio';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/articles',
    name: '官方快讯',
    url: 'www.quark.cn/articles',
    maintainers: ['user'],
    categories: ['new-media'],
    example: '/quark/articles',
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['quark.cn/articles'],
            target: '/articles',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://www.quark.cn/articles';

        return await cache.tryGet(
            baseUrl,
            async () => {
                const { page, destory } = await getPuppeteerPage(baseUrl, {
                    gotoConfig: {
                        waitUntil: 'networkidle2',
                    },
                });

                try {
                    // Get the window.__wh_data__ object from the page
                    const data = await page.evaluate(() => {
                        if ((window as any).__wh_data__ && (window as any).__wh_data__.page) {
                            // Find the key containing tabsConfig
                            for (const key in (window as any).__wh_data__.page) {
                                const pageData = (window as any).__wh_data__.page[key];
                                if (pageData && pageData.tabsConfig) {
                                    return pageData.tabsConfig;
                                }
                            }
                        }
                        return null;
                    });

                    if (!data || !Array.isArray(data)) {
                        throw new Error('Unable to extract tabsConfig from __wh_data__');
                    }

                    const items: Array<{
                        title: string;
                        link: string;
                        description: string;
                        pubDate?: Date;
                        author: string;
                        category: string;
                        image?: string;
                    }> = [];

                    // Process all tabs and their articles
                    for (const tab of data) {
                        if (tab.articleList && Array.isArray(tab.articleList)) {
                            for (const article of tab.articleList) {
                                if (article.title && article.url) {
                                    // Convert URL from broccoli.uc.cn format to www.quark.cn format
                                    let articleUrl = article.url;
                                    if (articleUrl.includes('broccoli.uc.cn/apps/qkhomepage/routes/article')) {
                                        const articleId = articleUrl.match(/article(\d+)/)?.[1];
                                        if (articleId) {
                                            articleUrl = `https://www.quark.cn/articles/${articleId}.html`;
                                        }
                                    }

                                    let description = '';
                                    if (article.content && article.content.data) {
                                        description = String(article.content.data);
                                        // Clean up HTML if present
                                        const $ = load(description);
                                        description = $.text().trim();
                                    }

                                    let pubDate: Date | undefined;
                                    if (article.content?.ext?.updateTime) {
                                        try {
                                            pubDate = new Date(article.content.ext.updateTime);
                                            if (Number.isNaN(pubDate.getTime())) {
                                                pubDate = undefined;
                                            }
                                        } catch (error) {
                                            logger.error(`Failed to parse date: ${article.content.ext.updateTime}`, error);
                                        }
                                    }

                                    items.push({
                                        title: String(article.title).trim(),
                                        link: articleUrl,
                                        description,
                                        pubDate,
                                        author: '夸克',
                                        category: tab.name || '未分类',
                                        image: article.img,
                                    });
                                }
                            }
                        }
                    }

                    // Sort by publication date (newest first)
                    items.sort((a, b) => {
                        if (!a.pubDate && !b.pubDate) {
                            return 0;
                        }
                        if (!a.pubDate) {
                            return 1;
                        }
                        if (!b.pubDate) {
                            return -1;
                        }
                        return b.pubDate.getTime() - a.pubDate.getTime();
                    });

                    return {
                        title: '夸克官方快讯',
                        link: baseUrl,
                        description: '夸克官方快讯和文章更新',
                        language: 'zh-CN',
                        item: items,
                    };
                } catch (error) {
                    logger.error(`Failed to fetch Quark articles: ${error}`);
                    throw error;
                } finally {
                    await destory();
                }
            },
            1800, // Cache for 30 minutes
            false
        );
    },
};
