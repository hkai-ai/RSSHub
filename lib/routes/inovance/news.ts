import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news/:typeId?',
    name: '新闻资讯',
    categories: ['programming'],
    example: '/inovance/news/2',
    parameters: {
        typeId: '新闻类型ID，默认为2（公司新闻）',
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
            source: ['www.inovance.com/portal/news/list'],
            target: '/news/:typeId',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const typeId = ctx.req.param('typeId') ?? '2';
        const pageUrl = `https://www.inovance.com/portal/news/list?typeId=${typeId}`;
        const apiUrl = `https://www.inovance.com/portal-front/api/news/list?pageNum=1&pageSize=10&isMainNews=${typeId}`;

        const response = await ofetch(apiUrl, {
            headers: {
                Referer: pageUrl,
            },
        });

        const items = response.rows.map((item) => ({
            title: item.newsTitle,
            link: item.pcNewsUrl,
            description: item.summary || item.newsDetailNoneTag || '',
            author: '汇川技术',
            category: ['公司新闻'],
            pubDate: timezone(parseDate(item.beginDate, 'YYYY-MM-DD HH:mm:ss'), +8),
            image: item.coverPic,
        }));

        return {
            title: `汇川技术 - 新闻资讯`,
            link: pageUrl,
            item: items,
            description: '汇川技术新闻资讯',
            language: 'zh-CN',
            image: 'https://www.inovance.com/favicon.ico',
        };
    },
};
