import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/',
    name: '文章列表',
    categories: ['new-media'],
    example: '/ne-time',
    maintainers: ['claude'],
    radar: [
        {
            source: ['ne-time.cn'],
            target: '/',
        },
    ],
    handler,
};

interface Article {
    id: number;
    title: string;
    summery: string;
    img: string;
    author: string;
    tag: string;
    timing: number;
}

interface ApiResponse {
    code: number;
    msg: string;
    obj: {
        rows: Article[];
    };
}

async function handler(): Promise<Data> {
    const baseUrl = 'https://www.ne-time.cn';
    const apiUrl = 'https://api.ne-time.cn/web/article/handleArticleList';

    const response = await ofetch<ApiResponse>(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Origin: 'https://www.ne-time.cn',
            Referer: 'https://www.ne-time.cn/',
        },
        body: 'page=1&limit=20&type=0',
    });

    const items: DataItem[] = response.obj.rows.map((article) => ({
        title: article.title,
        description: article.summery,
        link: `${baseUrl}/web/article/${article.id}`,
        pubDate: new Date(article.timing),
        author: article.author,
        category: article.tag.split(','),
        image: article.img,
    }));

    return {
        title: 'NE时代',
        link: baseUrl,
        item: items,
    };
}
