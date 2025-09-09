import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news',
    categories: ['new-media'],
    example: '/minimaxi/news',
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
            source: ['minimaxi.com/news'],
            target: '/news',
        },
    ],
    name: '新闻动态',
    maintainers: [''],
    handler,
};

async function handler() {
    const rootUrl = 'https://www.minimaxi.com';
    const apiUrl = 'https://www.minimaxi.com/nezha/zh/news';

    const response = await got({
        method: 'get',
        url: apiUrl,
        searchParams: {
            page: 1,
        },
    });

    const data = response.data;

    if (data.base_resp.status_code !== 0) {
        throw new Error(`API Error: ${data.base_resp.status_msg}`);
    }

    const items = data.data.map((item) => ({
        title: item.title,
        link: `${rootUrl}/news/${encodeURIComponent(item.slug)}`,
        description: item.summary,
        pubDate: parseDate(item.publishDate),
        category: item.tags,
        image: item.coverImageUrl,
    }));

    return {
        title: 'MiniMax - 新闻动态',
        link: `${rootUrl}/news`,
        item: items,
    };
}
