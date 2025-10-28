import type { Route } from '@/types';
import { load } from 'cheerio';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { config } from '@/config';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/changelog',
    name: 'Monica 更新日志',
    categories: ['programming', 'new-media'],
    example: '/monica/changelog',
    maintainers: ['claude-assistant'],
    handler: async () => {
        const baseUrl = 'https://monica.im';
        const changelogUrl = `${baseUrl}/help/zh-cn/Changelog/`;

        return await cache.tryGet(
            changelogUrl,
            async () => {
                try {
                    const html = await ofetch(changelogUrl, {
                        headers: {
                            'User-Agent': config.ua,
                        },
                    });

                    const $ = load(html);

                    // Find the changelog sidebar items
                    const changelogItems: Array<{
                        title: string;
                        link: string;
                        description: string;
                        pubDate?: Date;
                    }> = [];

                    // Look for the changelog category in sidebar
                    $('.theme-doc-sidebar-item-category').each((_, categoryElement) => {
                        const $category = $(categoryElement);
                        const categoryLink = $category.find('a.menu__link--active').attr('href');

                        // Check if this is the changelog category
                        if (categoryLink && categoryLink.includes('/Changelog/')) {
                            // Find all changelog items in the submenu
                            $category.find('.theme-doc-sidebar-item-link a.menu__link').each((_, linkElement) => {
                                const $link = $(linkElement);
                                const href = $link.attr('href');
                                const title = $link.text().trim();

                                if (href && title) {
                                    const fullLink = href.startsWith('http') ? href : `${baseUrl}${href}`;

                                    // Extract version info from title for better description
                                    const versionMatch = title.match(/Monica\s+(\d+\.\d+\.\d+)/);
                                    const version = versionMatch ? versionMatch[1] : '';

                                    changelogItems.push({
                                        title,
                                        link: fullLink,
                                        description: version ? `Monica ${version} 版本更新详情` : `${title} - 查看完整更新内容`,
                                    });
                                }
                            });
                        }
                    });

                    // Fetch detailed content for each changelog item
                    const items = await Promise.all(
                        changelogItems.slice(0, 20).map(
                            (item) =>
                                cache.tryGet(
                                    item.link,
                                    async () => {
                                        try {
                                            const itemHtml = await ofetch(item.link, {
                                                headers: {
                                                    'User-Agent': config.ua,
                                                },
                                            });

                                            const $item = load(itemHtml);

                                            // Extract main content
                                            const content = $item('article .markdown').html() || $item('[class*="docItemContainer"] .markdown').html() || $item('.theme-doc-markdown').html() || item.description;

                                            // Try to extract publish date from content
                                            let pubDate: Date | undefined;
                                            const dateText = $item('.theme-doc-breadcrumbs, .breadcrumbs, time').text();
                                            if (dateText) {
                                                const cleanDateText = dateText.replace(/发布时间[：:]?\s*/, '').trim();
                                                pubDate = parseDate(cleanDateText);
                                            }

                                            // If no date found, try to extract from URL or title
                                            if (!pubDate) {
                                                const versionMatch = item.title.match(/(\d+\.\d+\.\d+)/);
                                                if (versionMatch) {
                                                    // Use current date as fallback for version releases
                                                    pubDate = new Date();
                                                }
                                            }

                                            return {
                                                title: item.title,
                                                link: item.link,
                                                description: content || item.description,
                                                pubDate,
                                            };
                                        } catch (itemError) {
                                            logger.error(`Failed to fetch changelog item ${item.link}:`, itemError);
                                            return {
                                                title: item.title,
                                                link: item.link,
                                                description: item.description,
                                            };
                                        }
                                    },
                                    604800
                                ) // Cache each article for 1 week
                        )
                    );

                    return {
                        title: 'Monica 更新日志',
                        link: changelogUrl,
                        description: 'Monica AI 助手平台的最新功能更新和版本发布信息',
                        language: 'zh-cn',
                        item: items.filter(Boolean),
                    };
                } catch (error) {
                    logger.error('Failed to fetch Monica changelog:', error);
                    throw error;
                }
            },
            900,
            false
        ); // Cache list for 15 minutes
    },
};
