import { Route } from '@/types';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPageBypass } from '@/utils/puppeteer';
import cache from '@/utils/cache';

export const route: Route = {
    path: '/ai-latest-thinking',
    categories: ['programming'],
    example: '/kwm/ai-latest-thinking',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['kwm.com/cn/zh/expertise/sectors/artificial-intelligence/artificial-intelligence-latest-thinking.html'],
        },
    ],
    name: '人工智能专栏 - 最新文章',
    maintainers: [''],
    handler,
    url: 'kwm.com/cn/zh/expertise/sectors/artificial-intelligence/artificial-intelligence-latest-thinking.html',
};

async function handler() {
    const baseUrl = 'https://www.kwm.com';
    const currentUrl = `${baseUrl}/cn/zh/expertise/sectors/artificial-intelligence/artificial-intelligence-latest-thinking.html`;

    return await cache.tryGet(
        currentUrl,
        async () => {
            const { page, destory } = await getPuppeteerPageBypass(currentUrl, {
                gotoConfig: { waitUntil: 'domcontentloaded' },
            });

            const html = await page.content();
            await destory();

            const $ = load(html);

            const items = $('.article-display .article-body .article-item')
                .toArray()
                .map((item) => {
                    const $item = $(item);

                    // 跳过隐藏的文章
                    if ($item.hasClass('item-hide')) {
                        return null;
                    }

                    const title = $item.find('h3').text().trim();
                    const relativeLink = $item.find('a').attr('href');
                    const link = relativeLink ? `${baseUrl}${relativeLink}` : '';
                    const description = $item.find('.abstract').text().trim();
                    const dateText = $item.find('.date').text().trim();

                    // 处理日期格式 (2025/08/14 -> 2025-08-14)
                    const formattedDate = dateText.replaceAll('/', '-');
                    const pubDate = parseDate(formattedDate);

                    return {
                        title,
                        link,
                        description,
                        pubDate,
                        category: ['人工智能', '法律'],
                        author: '金杜律师事务所',
                    };
                })
                .filter(Boolean); // 移除 null 值

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
