import { load } from 'cheerio';

import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { requireProductItems } from '@/utils/product-updates';

interface ProfileWork {
    id: number;
    title: string;
    web_url: string;
    content?: string;
    description?: string;
    publish_time?: number;
    is_private?: boolean;
    author?: { userinfo?: { username?: string } };
}

export const parseProfile = (html: string) => {
    const $ = load(html);
    const data = JSON.parse($('#__NEXT_DATA__').text()) as { props: { pageProps: { articleData: { list: ProfileWork[] } } } };
    return parsePublicWorks({ status: 0, data: data.props.pageProps.articleData });
};

interface WorksResponse {
    status: number;
    data?: { list: ProfileWork[] };
}

export const parsePublicWorks = (response: WorksResponse) =>
    requireProductItems(
        (response.status === 0 ? (response.data?.list ?? []) : [])
            .filter((entry) => !entry.is_private)
            .map((entry) => ({
                title: entry.title,
                link: entry.web_url,
                guid: `xinpianchang:${entry.id}`,
                description: entry.content ?? entry.description ?? '',
                pubDate: entry.publish_time ? parseDate(entry.publish_time * 1000) : undefined,
                author: entry.author?.userinfo?.username,
            })),
        '新片场用户作品'
    );

export const route: Route = {
    path: '/user/:uid',
    name: '用户主页作品',
    categories: ['new-media'],
    example: '/xinpianchang/user/16448630',
    parameters: { uid: '用户主页u后面的数字ID' },
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async (ctx) => {
        const { uid } = ctx.req.param();
        if (!/^\d+$/.test(uid)) {
            throw new InvalidParameterError('Use the numeric user ID.');
        }
        const link = `https://www.xinpianchang.com/u${uid}`;
        const response = await ofetch<WorksResponse>(`https://www.xinpianchang.com/api/xpc/v2/user/${uid}/articles`, {
            query: { page: 1, per_page: 20, public_status: 0, order: 'new' },
            responseType: 'json',
        });
        const item = parsePublicWorks(response);
        return { title: `${item[0].author ?? `新片场用户${uid}`} · 公开作品`, link, item };
    },
};
