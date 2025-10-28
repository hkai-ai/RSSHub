import type { Route } from '@/types';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { getPuppeteerPage } from '@/utils/puppeteer';
import { load } from 'cheerio';
import timezone from '@/utils/timezone';
export const route: Route = {
    path: '/models',
    name: 'MiniMax 模型发布',
    url: 'platform.minimaxi.com/document/models',
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
    maintainers: ['DIYgod'],
    handler: async () => {
        const baseUrl = 'https://platform.minimaxi.com/document/models';

        return await cache.tryGet(
            baseUrl,
            async () => {
                const { page, destory } = await getPuppeteerPage(baseUrl, {
                    gotoConfig: {
                        waitUntil: 'networkidle2',
                    },
                });

                try {
                    // Wait for the main content to load
                    await page.waitForSelector('main.ant-layout-content', { timeout: 30000 });

                    // Get the HTML content
                    const html = await page.content();
                    const $ = load(html);

                    const items: Array<{
                        title: string;
                        description: string;
                        link: string;
                        pubDate: Date;
                        author: string;
                        category: string;
                    }> = [];

                    // Extract update entries
                    $(String.raw`.flex-1.min-w-0.max-w-\[1120px\]`)
                        .children()
                        .each((_, element) => {
                            const $element = $(element);

                            // Check if this is a date section with specific classes
                            const dateText = $element.text().trim();
                            if (/\d{4}年\d{1,2}月\d{1,2}日/.test(dateText) && $element.hasClass('text-[#181E25]') && $element.hasClass('text-[16px]') && $element.hasClass('leading-[20px]') && $element.hasClass('font-[600]')) {
                                const date = timezone(parseDate(dateText, 'YYYY年M月D日'), 8);

                                // Find the next grid container with model cards
                                const $grid = $element.next('.grid.grid-cols-1.gap-4');
                                if ($grid.length) {
                                    $grid.find(String.raw`.rounded-\[16px\]`).each((_, card) => {
                                        const $card = $(card);

                                        const title = $card
                                            .find(String.raw`.text-\[\#181E25\].text-\[18px\]`)
                                            .first()
                                            .text()
                                            .trim();
                                        const description = $card
                                            .find(String.raw`.text-\[\#181E25\].text-\[14px\].opacity-65`)
                                            .first()
                                            .text()
                                            .trim();
                                        const image = $card.find('img').first().attr('src');
                                        const link = $card.find('a').first().attr('href');

                                        if (title) {
                                            let fullDescription = description;
                                            if (image) {
                                                fullDescription = `<img src="${image}" alt="${title}" /><br/><br/>${description}`;
                                            }

                                            items.push({
                                                title,
                                                description: fullDescription,
                                                link: link ? (link.startsWith('http') ? link : `https://platform.minimaxi.com${link}`) : baseUrl,
                                                pubDate: date,
                                                author: 'MiniMax',
                                                category: 'AI',
                                            });
                                        }
                                    });
                                }
                            }
                        });

                    return {
                        title: 'MiniMax 模型发布',
                        link: baseUrl,
                        description: 'MiniMax AI 模型更新日志',
                        language: 'zh-CN',
                        item: items,
                    };
                } catch (error) {
                    logger.error(`Failed to fetch MiniMax models: ${error}`);
                    throw error;
                } finally {
                    await destory();
                }
            },
            3600,
            false
        ); // Cache for 1 hour
    },
};
