import { load } from 'cheerio';

import type { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { fetchProductHtml, requireProductItems } from '@/utils/product-updates';

const link = 'https://forum.wps.cn/topics/node/8?sort=newest';

export const parseCommunity = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('a[href^="/topic/"]')
            .toArray()
            .flatMap((anchor) => {
                const title = $(anchor).find('h1,h2,h3,h4').text().trim() || ($(anchor).parent().is('h1,h2,h3,h4') ? $(anchor).text().trim() : '');
                if (!title) {
                    return [];
                }
                const entry = $(anchor).closest('[class*="topic-item"],.qa-question,[class*="topic-card"]');
                const date = entry.find('time[datetime]').first().attr('datetime');
                return [
                    {
                        title,
                        link: new URL($(anchor).attr('href')!, link).href,
                        description: entry.find('.topic-content,.topic-summary,.qa-summary').first().html() ?? '',
                        pubDate: date ? parseDate(/(?:Z|[+-]\d{2}:\d{2})$/.test(date) ? date : `${date}+08:00`) : undefined,
                    },
                ];
            }),
        'WPS AI 社区'
    );
};

export const route: Route = {
    path: '/ai/community',
    name: 'AI社区讨论',
    categories: ['bbs'],
    example: '/wps/ai/community',
    maintainers: ['hkai-ai'],
    description: 'WPS官方社区AI板块，包含用户讨论与问答；不是产品官方版本公告。',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'WPS AI 社区讨论', link, item: parseCommunity(await fetchProductHtml(link)) }),
};
