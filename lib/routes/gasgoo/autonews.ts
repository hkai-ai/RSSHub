import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/autonews/:section?',
    name: '汽车新闻',
    categories: ['new-media'],
    example: '/gasgoo/autonews/market-industry',
    parameters: {
        section: '板块名称，默认为 market-industry。新版站点改用 /articles/<slug> 形式，旧 china_news/europe_news 仍兼容映射到 market-industry。',
    },
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
            source: ['autonews.gasgoo.com/articles/:section', 'autonews.gasgoo.com/:section'],
            target: '/autonews/:section',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const rawSection = ctx.req.param('section') || 'market-industry';
        // 旧的 china_news 已被合并为 market-industry，做兼容映射
        const sectionMap: Record<string, string> = {
            china_news: 'market-industry',
            europe_news: 'market-industry',
        };
        const section = sectionMap[rawSection] || rawSection;
        const url = `https://autonews.gasgoo.com/articles/${section}`;

        const html = await fetchHtmlWithFallback(url);
        const $ = load(html);

        const seen = new Set<string>();
        const items = $(`a[href^="/articles/${section}/"]`)
            .toArray()
            .map((element) => {
                const $a = $(element);
                const href = $a.attr('href') || '';
                if (!/\/articles\/[^/]+\/[a-z0-9-]+(?:-\d+)?$/i.test(href)) {
                    return null;
                }
                const link = href.startsWith('http') ? href : `https://autonews.gasgoo.com${href}`;
                if (seen.has(link)) {
                    return null;
                }
                seen.add(link);

                const title = $a.text().trim();
                if (!title) {
                    return null;
                }
                // 日期常常出现在 link 的相邻 sibling 中，向后/向上找一下
                const dateText =
                    $a.next('span').text().trim() ||
                    $a
                        .parent()
                        .find('span')
                        .toArray()
                        .map((el) => $(el).text().trim())
                        .find((t) => /^[A-Za-z]{3,9}\.?\s+\d{1,2}\s*,?\s*\d{4}$/.test(t)) ||
                    '';

                let pubDate: Date | undefined;
                if (dateText) {
                    const cleanDate = dateText
                        .replace(/^([A-Za-z]{3})\./, '$1')
                        .replaceAll(/\s*,\s*/g, ', ')
                        .replaceAll(/\s+/g, ' ')
                        .trim();
                    const parsed = parseDate(cleanDate, 'MMM D, YYYY', 'en');
                    if (!Number.isNaN(parsed.getTime())) {
                        pubDate = timezone(parsed, 8);
                    }
                }

                return {
                    title,
                    link,
                    description: title,
                    pubDate,
                };
            })
            .filter((it): it is NonNullable<typeof it> => it !== null);

        const pageTitle = $('title').text().trim() || `Gasgoo Automotive News - ${section}`;

        return {
            title: pageTitle,
            link: url,
            item: items,
            description: `Gasgoo automotive news - ${section} section`,
            language: 'en',
            image: 'https://autonews.gasgoo.com/favicon.ico',
        };
    },
};
