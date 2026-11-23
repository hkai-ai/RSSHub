import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPage } from '@/utils/puppeteer';

export const route: Route = {
    path: '/release-history',
    categories: ['program-update'],
    example: '/klingai/release-history',
    parameters: {},
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
            source: ['klingai.com/release-note/release-history', 'kling.ai/release-note/release-history'],
        },
    ],
    name: '更新日志',
    maintainers: ['your-username'],
    handler,
};

async function handler() {
    const baseUrl = 'https://kling.ai';
    const targetUrl = 'https://klingai.com/release-note/release-history';

    const items = await cache.tryGet(
        'klingai:release-history',
        async () => {
            const { page, destory } = await getPuppeteerPage(targetUrl, {
                gotoConfig: {
                    waitUntil: 'networkidle0',
                },
            });

            try {
                // Wait for content to load
                await page.waitForSelector('.content-item', { timeout: 15000 });

                // Get page content
                const content = await page.content();
                const $ = load(content);

                const items = [];
                const seenDates = new Map<string, number>();

                $('.content-item').each((i, element) => {
                    const $item = $(element);
                    const dateText = $item.find('.date').text().trim();
                    const title = $item.find('.title').text().trim();
                    const content = $item.find('.content').text().trim();
                    const isMajor = $item.find('.major').length > 0;

                    if (dateText && title) {
                        const fullTitle = isMajor && !title.startsWith('【') ? `【重磅】${title}` : title;
                        const count = (seenDates.get(dateText) ?? 0) + 1;
                        seenDates.set(dateText, count);
                        const suffix = count > 1 ? `#${count}` : '';
                        const releaseNotesUrl = `${baseUrl}/release-note/release-notes/${encodeURIComponent(dateText)}${suffix}`;

                        items.push({
                            title: fullTitle,
                            description: content,
                            pubDate: parseDate(dateText),
                            link: releaseNotesUrl,
                            guid: `klingai-${dateText}-${i}`,
                            author: '可灵AI',
                        });
                    }
                });

                return items;
            } finally {
                await destory();
            }
        },
        30 * 60 * 1000,
        false
    ); // 30分钟缓存

    return {
        title: '可灵AI - 更新日志',
        link: targetUrl,
        description: '可灵AI官方更新日志RSS订阅',
        item: items,
    };
}
