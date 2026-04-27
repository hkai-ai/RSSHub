import { load } from 'cheerio';

import type { Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/ai-latest-thinking',
    categories: ['programming'],
    example: '/kwm/ai-latest-thinking',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.kingandwood.com/cn/zh/expertise/sectors/artificial-intelligence.html', 'kwm.com/cn/zh/expertise/sectors/artificial-intelligence/artificial-intelligence-latest-thinking.html'],
        },
    ],
    name: '人工智能专栏 - 最新文章',
    maintainers: [''],
    handler,
    url: 'www.kingandwood.com/cn/zh/expertise/sectors/artificial-intelligence.html',
};

async function handler() {
    // 旧 `kwm.com/.../artificial-intelligence-latest-thinking.html` 已 301 / 下线，
    // 父页 kingandwood.com 现承载 AI 专栏完整列表
    const baseUrl = 'https://www.kingandwood.com';
    const currentUrl = `${baseUrl}/cn/zh/expertise/sectors/artificial-intelligence.html`;

    return await cache.tryGet(
        currentUrl,
        async () => {
            const html = await fetchHtmlWithFallback(currentUrl);
            const $ = load(html);

            const items = $('.article-body .article-item, .article-item')
                .toArray()
                .map((item) => {
                    const $item = $(item);

                    const title = $item.find('h3').text().trim();
                    const $a = $item.find('a').first();
                    const relativeLink = $a.attr('href');
                    if (!title || !relativeLink) {
                        return null;
                    }
                    const link = relativeLink.startsWith('http') ? relativeLink : `${baseUrl}${relativeLink}`;
                    const description = $item.find('.abstract, p.abstract').text().trim() || title;
                    const dateText = $item.find('.date, p.date').first().text().trim();
                    const formattedDate = dateText.replaceAll('/', '-');
                    const pubDate = formattedDate ? parseDate(formattedDate) : undefined;

                    return {
                        title,
                        link,
                        description,
                        pubDate,
                        category: ['人工智能', '法律'],
                        author: '金杜律师事务所',
                    };
                })
                .filter((it): it is NonNullable<typeof it> => it !== null);

            return {
                title: '金杜律师事务所 - 人工智能专栏最新文章',
                link: currentUrl,
                description: '金杜律师事务所人工智能领域的最新法律观察和专业文章',
                language: 'zh-cn',
                item: items,
            };
        },
        300
    );
}
