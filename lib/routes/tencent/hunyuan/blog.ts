import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';

interface HunyuanApiResponse {
    code: number;
    msg: string;
    data: {
        total: number;
        items: Array<{
            id: number;
            content_type: string;
            title: string;
            content_brief: string;
            url: string;
            other_info: string;
            published_at: number;
            created_at: number;
            updated_at: number;
            research_area: string;
            dynamic_info: string;
        }>;
    };
}

export const route: Route = {
    path: '/hunyuan/blog',
    categories: ['programming'],
    example: '/tencent/hunyuan/blog',
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
            source: ['hunyuan.tencent.com/news/blog'],
            target: '/hunyuan/blog',
        },
    ],
    name: '腾讯混元博客',
    maintainers: ['claude'],
    handler: async () => {
        const apiUrl = 'https://api.hunyuan.tencent.com/api/vision_platform/public/auditOpenAPI/dynamic/list';

        const response = await cache.tryGet(
            apiUrl,
            async () =>
                await ofetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                        Accept: 'application/json, text/plain, */*',
                        'Content-Type': 'application/json',
                        'X-Source': 'web',
                        withCredentials: 'true',
                    },
                    body: {
                        page_id: 1,
                        page_size: 20,
                        key: '',
                        order_by: 'published_at',
                        order_dir: 'desc',
                    },
                })
        );
        const data: HunyuanApiResponse = typeof response === 'string' ? JSON.parse(response) : response;
        const items = data.data.items.map((item) => ({
            title: item.title,
            link: item.url,
            description: item.content_brief,
            pubDate: parseDate(item.published_at, 'X'),
            author: item.other_info,
            category: item.content_type,
        }));

        return {
            title: '腾讯混元博客',
            link: 'https://hunyuan.tencent.com/news/blog',
            description: '腾讯混元官方博客，发布最新的AI模型和技术动态',
            item: items,
        };
    },
};
