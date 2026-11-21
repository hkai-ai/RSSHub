import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchProductHtml, productDate, requireProductItems } from '@/utils/product-updates';

const link = 'https://www.sensetime.com/cn/news';

export const parseNews = (html: string) => {
    const $ = load(html);
    return requireProductItems(
        $('main a[href^="/cn/news/"]')
            .toArray()
            .flatMap((element) => {
                const entry = $(element);
                const title = entry.find('h2,h3,h4,strong,[class*="_cardTitle"]').first().text().trim();
                if (!title) {
                    return [];
                }
                return [{ title, link: new URL(entry.attr('href')!, link).href, description: entry.find('p,[class*="_cardSummary"]').first().html() ?? '', pubDate: productDate(entry.text()) }];
            }),
        '商汤新闻'
    );
};

export const route: Route = {
    path: '/news',
    name: '新闻中心',
    categories: ['new-media'],
    example: '/sensetime/news',
    maintainers: ['hkai-ai'],
    description: '商汤公司共享新闻渠道，涉及Seko等产品；可使用RSSHub通用过滤参数筛选产品关键词。',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: '商汤新闻中心', link, item: parseNews(await fetchProductHtml(link)) }),
};
