import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/models',
    name: 'MiniMax 模型发布',
    url: 'platform.minimaxi.com/docs/release-notes/models',
    categories: ['programming'],
    example: '/minimaxi/models',
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['platform.minimaxi.com/docs/release-notes/models', 'www.minimaxi.com/release-notes/models'],
            target: '/models',
        },
    ],
    maintainers: ['DIYgod'],
    handler: async () => {
        const baseUrl = 'https://platform.minimaxi.com/docs/release-notes/models';

        return await cache.tryGet(
            baseUrl,
            async () => {
                const response = await fetchHtmlWithFallback(baseUrl);

                const $ = load(response);

                const items: Array<{
                    title: string;
                    description: string;
                    link: string;
                    pubDate: Date;
                }> = [];

                let currentDate: Date | null = null;

                // 兼容多种 h2 写法：`2026 年 3 月 18 日` / `2026年3月18日` / `2026 年 3 月`，零宽字符与全角空格都过滤掉
                const dateRegex = /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/;

                $('#content')
                    .children()
                    .each((_, element) => {
                        const $element = $(element);

                        if ($element.is('h2')) {
                            const dateText = $element
                                .text()
                                .replaceAll(/​|‌|‍|﻿/g, '')
                                .trim();
                            const match = dateText.match(dateRegex);
                            if (match) {
                                const [, year, month, day] = match;
                                const formatted = day ? `${year}-${month}-${day}` : `${year}-${month}-1`;
                                currentDate = timezone(parseDate(formatted, 'YYYY-M-D'), 8);
                            }
                            return;
                        }

                        // 卡片为 div.card（不再是 a.card），无 href，使用日期 anchor 作为 link
                        if ($element.is('div.card, a.card') && currentDate) {
                            const title = $element.find('[data-component-part="card-title"]').text().trim();
                            const descriptionSpans = $element.find('[data-component-part="card-content"] span[data-as="p"]');
                            const descriptionParts: string[] = [];
                            descriptionSpans.each((_, span) => {
                                const text = $(span).html();
                                if (text) {
                                    descriptionParts.push(text);
                                }
                            });

                            const description = descriptionParts.join('<br><br>');
                            const headingId = $element.prevAll('h2').first().attr('id') || '';
                            const href = $element.is('a') ? $element.attr('href') : undefined;
                            const link = href ? (href.startsWith('http') ? href : `${baseUrl.replace(/\/[^/]*$/, '')}${href}`) : `${baseUrl}#${headingId}`;

                            if (title) {
                                items.push({
                                    title,
                                    description,
                                    link,
                                    pubDate: currentDate,
                                });
                            }
                        }
                    });

                return {
                    title: 'MiniMax 模型发布',
                    link: baseUrl,
                    description: 'MiniMax AI 模型更新日志',
                    language: 'zh-CN' as const,
                    item: items,
                };
            },
            3600,
            false
        );
    },
};
