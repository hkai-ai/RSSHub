import { Route } from '@/types';
import { getPuppeteerPage } from '@/utils/puppeteer';
import { load } from 'cheerio';
import timezone from '@/utils/timezone';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/product-updates',
    name: '产品常规公告',
    url: 'help.esign.cn',
    description: 'e签宝产品常规公告，获取最新的产品功能更新、优化内容和相关日志。',
    categories: ['program-update', 'finance'],
    example: '/esign/product-updates',
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['help.esign.cn/detail?id=uc2xdk&nameSpace=cs3-dept%2Fza62ha'],
            target: '/esign/product-updates',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const url = 'https://help.esign.cn/detail?id=uc2xdk&nameSpace=cs3-dept%2Fza62ha';

        try {
            // 使用 Puppeteer 获取 JS 渲染后的页面内容
            const { page, destory } = await getPuppeteerPage(url, {
                gotoConfig: {
                    waitUntil: 'networkidle2',
                },
            });

            try {
                // 等待表格内容加载
                await page.waitForSelector('.lake-content .ne-table', { timeout: 30000 });

                // 获取页面HTML内容
                const html = await page.content();
                const $ = load(html);

                const items: Array<{
                    title: string;
                    link: string;
                    description: string;
                    pubDate: Date;
                }> = [];

                // 查找包含更新动态的表格
                const table = $('.lake-content .ne-table').first();

                if (!table.length) {
                    logger.warn('未找到产品更新表格');
                    return {
                        title: 'e签宝产品常规公告',
                        link: url,
                        description: 'e签宝产品常规公告，获取最新的产品功能更新、优化内容和相关日志。',
                        language: 'zh-CN',
                        item: [],
                    };
                }

                // 遍历表格行
                table.find('tr').each((index, element) => {
                    const $row = $(element);
                    const $cells = $row.find('td');

                    if ($cells.length < 3) {
                        return; // 确保有足够的列
                    }

                    // 获取更新日期（第一列）
                    const dateText = $cells.eq(0).find('.ne-text').text().trim();
                    if (!dateText || !/\d{4}年\d{1,2}月\d{1,2}日/.test(dateText)) {
                        return; // 跳过没有有效日期的行
                    }

                    // 解析日期，格式如 "2025年11月6日"
                    let pubDate: Date;
                    try {
                        pubDate = timezone(parseDate(dateText, ['YYYY年M月D日', 'YYYY年M月DD日']), 8);
                        if (Number.isNaN(pubDate.getTime())) {
                            logger.warn(`无效日期格式: ${dateText}`);
                            return;
                        }
                    } catch (error) {
                        logger.warn(`日期解析错误: ${dateText}`, error);
                        return;
                    }

                    // 获取更新内容（第二列）
                    const updateContentParts: string[] = [];

                    // 处理不同类型的内容结构
                    $cells
                        .eq(1)
                        .find('p, ol li')
                        .each((_, contentElement) => {
                            const text = $(contentElement).text().trim();
                            if (text) {
                                updateContentParts.push(text);
                            }
                        });

                    // 处理有序列表
                    $cells
                        .eq(1)
                        .find('ol.ne-ol')
                        .each((_, olElement) => {
                            $(olElement)
                                .find('li')
                                .each((_, liElement) => {
                                    const text = $(liElement).text().trim();
                                    if (text) {
                                        updateContentParts.push(text);
                                    }
                                });
                        });

                    const updateContent = updateContentParts.join('<br>');
                    if (!updateContent) {
                        return; // 跳过没有内容的行
                    }

                    // 获取更新日志链接（第三列）
                    const linkElement = $cells.eq(2).find('a').first();
                    if (!linkElement.length) {
                        return; // 跳过没有链接的行
                    }

                    const link = linkElement.attr('href');
                    const linkText = linkElement.text().trim();

                    if (!link || !linkText) {
                        return; // 跳过无效链接
                    }

                    // 使用链接文本作为标题，更新内容作为描述
                    items.push({
                        title: linkText,
                        link: link.startsWith('http') ? link : `https://help.esign.cn${link}`,
                        description: updateContent,
                        pubDate,
                    });
                });

                // 按日期降序排序
                items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

                logger.info(`成功解析到 ${items.length} 条产品更新记录`);

                return {
                    title: 'e签宝产品常规公告',
                    link: url,
                    description: 'e签宝产品常规公告，获取最新的产品功能更新、优化内容和相关日志。',
                    language: 'zh-CN',
                    item: items,
                };
            } finally {
                // 清理资源
                await destory();
            }
        } catch (error) {
            logger.error('获取e签宝产品更新失败:', error);
            throw new Error('Failed to fetch product updates from help.esign.cn');
        }
    },
};
