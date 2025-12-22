import { load } from 'cheerio';
import { ofetch } from 'ofetch';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/models',
    name: 'MiniMax 模型发布',
    url: 'www.minimaxi.com',
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
            source: ['www.minimaxi.com/release-notes/models'],
            target: '/models',
        },
    ],
    maintainers: ['DIYgod'],
    handler: async () => {
        const baseUrl = 'https://platform.minimaxi.com/docs/release-notes/models';

        return await cache.tryGet(
            baseUrl,
            async () => {
                const response = await ofetch(baseUrl);

                const $ = load(response);

                const items: Array<{
                    title: string;
                    description: string;
                    link: string;
                    pubDate: Date;
                }> = [];

                // Extract update entries from the new structure
                let currentDate: Date | null = null;

                // Process all h2 and card elements in order
                $('#content')
                    .children()
                    .each((_, element) => {
                        const $element = $(element);

                        // Check if this is a date heading
                        if ($element.is('h2')) {
                            const dateText = $element.find('span.cursor-pointer').text().trim();
                            if (/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/.test(dateText)) {
                                currentDate = timezone(parseDate(dateText, 'YYYY年M月D日'), 8);
                            }
                        }

                        // Check if this is a model card
                        if ($element.is('a.card') && currentDate) {
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
                            const link = $element.attr('href');

                            if (title && link) {
                                items.push({
                                    title,
                                    description,
                                    link: link.startsWith('http') ? link : `https://www.minimaxi.com${link}`,
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
        ); // Cache for 1 hour
    },
};
