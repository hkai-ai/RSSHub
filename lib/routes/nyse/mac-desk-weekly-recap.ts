import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/mac-desk-weekly-recap',
    name: 'MAC Desk Weekly Recap',
    categories: ['finance', 'traditional-media'],
    example: '/nyse/mac-desk-weekly-recap',
    maintainers: ['claude-code'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['e.nyse.com/mac-desk-weekly-recap'],
            target: '/mac-desk-weekly-recap',
        },
    ],
    handler: async () => {
        const url = 'https://e.nyse.com/mac-desk-weekly-recap';

        const html = await fetchHtmlWithFallback(url);
        const $ = load(html);

        // Eloqua 单页 landing page，每周覆盖最新一期。日期文本散落在 .elq-text-cell 中，
        // 直接对全文做正则匹配，找不到时退化为当前时间，不再抛错。
        const fullText = $.root().text();
        const dateMatch = fullText.match(/Published on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);

        let pubDate: Date = new Date();
        let dateParam = '';
        if (dateMatch) {
            dateParam = dateMatch[1];
            const [month, day, rawYear] = dateParam.split('/');
            const fullYear = rawYear.length === 2 ? (Number.parseInt(rawYear) <= 30 ? `20${rawYear}` : `19${rawYear}`) : rawYear;
            const baseDate = parseDate(`${month}/${day}/${fullYear} 08:00`, 'MM/DD/YYYY HH:mm');
            if (baseDate && !Number.isNaN(baseDate.getTime())) {
                pubDate = timezone(baseDate, -5);
            } else {
                logger.warn(`[nyse/mac-desk-weekly-recap] 解析日期失败：${dateParam}`);
            }
        } else {
            logger.warn('[nyse/mac-desk-weekly-recap] 页面未找到 "Published on" 文本，使用当前时间作为 pubDate');
        }

        const titleElement = $('h1').first();
        const title = titleElement.text().trim() || 'Weekly Recap';

        // 作者（容错，没找到不报错）
        const authorText = $('div, p, span')
            .filter((_, el) => /by\s+(Michael Reinking|Eric Criscuolo|NYSE\s+MAC)/i.test($(el).text()))
            .first()
            .text()
            .trim();
        const author = authorText.replace(/^.*by\s+/i, '').trim() || 'NYSE MAC Desk';

        // 用 .elq-lp 整体内容作描述兜底
        const description = $('.elq-text-cell.cell-2').first().html()?.trim() || $('.elq-lp').first().html()?.trim() || $('main').first().html()?.trim() || 'NYSE MAC Desk Weekly Market Recap';

        const linkWithDate = dateParam ? `${url}?date=${dateParam.replaceAll('/', '-')}` : url;

        const item = {
            title: `NYSE MAC Desk ${title}${dateParam ? ` - ${dateParam}` : ''}`,
            link: linkWithDate,
            guid: linkWithDate,
            description,
            author,
            pubDate,
            category: ['finance', 'markets', 'trading'],
        };

        return {
            title: 'NYSE MAC Desk Weekly Recap',
            link: url,
            description: 'Weekly market recap from the NYSE MAC Desk trading floor',
            item: [item],
        };
    },
};
