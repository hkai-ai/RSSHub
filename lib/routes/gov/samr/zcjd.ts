import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPage } from '@/utils/puppeteer';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/samr/zcjd',
    categories: ['government'],
    example: '/gov/samr/zcjd',
    name: '政策解读',
    maintainers: ['claude'],
    handler,
    radar: [
        {
            source: ['www.samr.gov.cn/zw/zjwj/zcjd/index.html'],
        },
    ],
};

async function handler() {
    const rootUrl = 'https://www.samr.gov.cn';
    const currentUrl = `${rootUrl}/zw/zjwj/zcjd/index.html`;

    const { page, destory } = await getPuppeteerPage(currentUrl, { gotoConfig: { waitUntil: 'networkidle0' } });

    try {
        const html = await page.content();
        const $ = load(html);

        const items: DataItem[] = $('ul')
            .toArray()
            .map((element) => {
                const $element = $(element);
                const $link = $element.find('li a');
                const title = $link.attr('title') || $link.text().trim();
                const link = $link.attr('href');
                const dateText = $element.find('[class*="_contenttime"]').text().trim();

                if (!link || !title || !dateText) {
                    return;
                }

                return {
                    title,
                    link: new URL(link, rootUrl).href,
                    pubDate: timezone(parseDate(dateText, 'YYYY-MM-DD'), 8),
                    description: '',
                } as DataItem;
            })
            .filter((item): item is DataItem => item !== undefined);

        return {
            title: '国家市场监督管理总局 - 政策解读',
            link: currentUrl,
            item: items,
            language: 'zh-CN' as const,
        };
    } finally {
        await destory();
    }
}
