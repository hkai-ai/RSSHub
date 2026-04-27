import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

interface ZuixinEntry {
    TITLE: string;
    SUB_TITLE?: string;
    URL: string;
    DOCRELPUBTIME: string;
}

export const route: Route = {
    path: ['/zhengce/zuixin', '/zhengce/:category{.+}?'],
    categories: ['government'],
    example: '/gov/zhengce/zuixin',
    parameters: {},
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
            source: ['www.gov.cn/zhengce/zuixin.htm', 'www.gov.cn/zhengce/zuixin/', 'www.gov.cn/'],
        },
    ],
    name: '最新政策',
    maintainers: ['SettingDust', 'nczitzk'],
    handler,
    url: 'www.gov.cn/zhengce/zuixin/',
};

async function handler(ctx): Promise<Data> {
    const { category = 'zuixin' } = ctx.req.param();
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20;

    const rootUrl = 'https://www.gov.cn';

    let baseItems: Array<{ title: string; link: string; pubDate: Date }> = [];

    if (category === 'zuixin') {
        // 列表已改为 AJAX JSON
        const jsonUrl = `${rootUrl}/zhengce/zuixin/ZUIXINZHENGCE.json`;
        const data = await ofetch<ZuixinEntry[]>(jsonUrl);
        baseItems = data.slice(0, limit).map((entry) => ({
            title: entry.TITLE,
            link: entry.URL.startsWith('http') ? entry.URL : new URL(entry.URL, rootUrl).href,
            pubDate: timezone(parseDate(entry.DOCRELPUBTIME, 'YYYY-MM-DD'), +8),
        }));
    } else {
        // 兼容老的 :category 子路径，仍走 HTML 抓取
        const currentUrl = new URL(`zhengce/${category.replace(/\/$/, '')}/`, rootUrl).href;
        const response = await fetchHtmlWithFallback(currentUrl);
        const $ = load(response);
        baseItems = $('h4 a, div.subtitle a[title]')
            .toArray()
            .map((item) => {
                const $a = $(item);
                const link = $a.attr('href') || '';
                return {
                    title: $a.text().trim(),
                    link: link.startsWith('http') ? link : new URL(link, currentUrl).href,
                    pubDate: undefined as unknown as Date,
                };
            })
            .filter((it) => /https?:\/\/www\.gov\.cn\/zhengce.*content_\d+\.htm/.test(it.link))
            .slice(0, limit);
    }

    const items: DataItem[] = await Promise.all(
        baseItems.map((item) =>
            cache.tryGet(item.link, async () => {
                try {
                    const detailResponse = await fetchHtmlWithFallback(item.link);
                    const content = load(detailResponse);

                    const processElementText = (el) => content(el).text().split(/：/).pop()!.trim() || content(el).next().text().trim();

                    const author = content('meta[name="author"]').prop('content');

                    const agencyEl = content('table.bd1')
                        .find('td')
                        .toArray()
                        .findLast((a) => content(a).text().startsWith('发文机关'));

                    const sourceEl = content('span.font-zyygwj')
                        .toArray()
                        .findLast((a) => content(a).text().startsWith('来源'));

                    const subjectEl = content('table.bd1')
                        .find('td')
                        .toArray()
                        .findLast((a) => content(a).text().startsWith('主题分类'));

                    const agency = agencyEl ? processElementText(agencyEl) : undefined;
                    const source = sourceEl ? processElementText(sourceEl) : undefined;
                    const subject = subjectEl ? processElementText(subjectEl) : content('td.zcwj_ztfl').text();

                    const column = content('meta[name="lanmu"]').prop('content');
                    const keywords = content('meta[name="keywords"]').prop('content')?.split(/;|,/) ?? [];
                    const manuscriptId = content('meta[name="manuscriptId"]').prop('content');

                    const firstPub = content('meta[name="firstpublishedtime"]').prop('content');
                    const lastMod = content('meta[name="lastmodifiedtime"]').prop('content');

                    const detailItem: DataItem = {
                        title: content('div.share-title').text() || item.title,
                        link: item.link,
                        description: content('div.TRS_UEDITOR').first().html() || content('div#UCAP-CONTENT, td#UCAP-CONTENT').first().html() || item.title,
                        author: [agency, source, author].filter(Boolean).join('/'),
                        category: [...new Set([subject, column, ...keywords].filter(Boolean) as string[])],
                        guid: manuscriptId ? `gov-zhengce-${manuscriptId}` : item.link,
                        pubDate: firstPub ? timezone(parseDate(firstPub, 'YYYY-MM-DD-HH:mm:ss'), +8) : item.pubDate,
                        updated: lastMod ? timezone(parseDate(lastMod, 'YYYY-MM-DD-HH:mm:ss'), +8) : undefined,
                    };

                    return detailItem;
                } catch {
                    return {
                        title: item.title,
                        link: item.link,
                        description: item.title,
                        pubDate: item.pubDate,
                    } as DataItem;
                }
            })
        )
    );

    return {
        item: items,
        title: '中国政府网 - 最新政策',
        link: `${rootUrl}/zhengce/zuixin/`,
        description: '中国政府网最新政策文件',
        language: 'zh-CN',
    };
}
