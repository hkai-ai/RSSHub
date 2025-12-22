import { URL } from 'node:url';

import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/product-updates',
    name: '法大大产品更新动态',
    url: 'support.fadada.com',
    description: '法大大产品更新动态，获取最新的产品功能更新、优化内容和相关日志。',
    categories: ['program-update', 'finance'],
    example: '/fadada/product-updates',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['support.fadada.com/d/1638785527073222657.html'],
            target: '/fadada/product-updates',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const url = 'https://support.fadada.com/d/1638785527073222657.html';

        try {
            const response = await ofetch(url);
            const $ = load(response);

            const items: Array<{
                title: string;
                link: string;
                description: string;
                pubDate: Date;
            }> = [];

            // 查找包含更新动态的表格
            const table = $('.editor-content table').first();

            if (!table.length) {
                return {
                    title: '法大大产品更新动态',
                    link: url,
                    description: '法大大产品更新动态，获取最新的产品功能更新、优化内容和相关日志。',
                    language: 'zh-CN',
                    item: [],
                };
            }

            // 遍历表格行，跳过表头
            table.find('tr').each((index, element) => {
                if (index === 0) {
                    return; // 跳过表头行
                }

                const $row = $(element);
                const $cells = $row.find('td');

                if ($cells.length < 3) {
                    return; // 确保有足够的列
                }

                // 获取更新日期（第一列）
                const dateText = $cells.eq(0).find('p').text().trim();
                if (!dateText) {
                    return; // 跳过没有日期的行
                }

                // 解析日期，格式如 "2025年11月13日"
                let pubDate: Date;
                try {
                    pubDate = timezone(parseDate(dateText, 'YYYY年M月D日'), 8);
                    if (!pubDate || Number.isNaN(pubDate.getTime())) {
                        return;
                    }
                } catch {
                    return;
                }

                // 获取更新内容（第二列）
                const updateContentParts: string[] = [];
                $cells
                    .eq(1)
                    .find('p')
                    .each((_, pElement) => {
                        const text = $(pElement).text().trim();
                        if (text) {
                            updateContentParts.push(text);
                        }
                    });

                const updateContent = updateContentParts.join('<br>');

                // 获取更新日志链接（第三列）
                const linkElement = $cells.eq(2).find('a').first();
                if (!linkElement.length) {
                    return; // 跳过没有链接的行
                }

                const relativeLink = linkElement.attr('href');
                const linkText = linkElement.text().trim();
                const dataHelpDocId = linkElement.attr('data-help-doc-id');

                if ((!relativeLink && !dataHelpDocId) || !linkText) {
                    return; // 跳过无效链接
                }

                // 构建完整链接
                const fullLink = relativeLink ? new URL(relativeLink, url).href : `https://support.fadada.com/d/${dataHelpDocId}.html`;

                // 使用链接文本作为标题，更新内容作为描述
                items.push({
                    title: linkText,
                    link: fullLink,
                    description: updateContent,
                    pubDate,
                });
            });

            // 按日期降序排序
            items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

            return {
                title: '法大大产品更新动态',
                link: url,
                description: '法大大产品更新动态，获取最新的产品功能更新、优化内容和相关日志。',
                language: 'zh-CN',
                item: items,
            };
        } catch {
            throw new Error('Failed to fetch product updates from support.fadada.com');
        }
    },
};
