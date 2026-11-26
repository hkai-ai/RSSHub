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
    author?: { userinfo?: { id?: number; username?: string } };
}

export const extractProfileWorksResponse = (html: string): WorksResponse => {
    const $ = load(html);
    const raw = $('#__NEXT_DATA__').text().trim();
    if (!raw) {
        return { status: -1 };
    }
    const data = JSON.parse(raw) as { props?: { pageProps?: { articleData?: { list?: ProfileWork[] } | ProfileWork[] } } };
    const articleData = data.props?.pageProps?.articleData;
    const list = Array.isArray(articleData) ? articleData : (articleData?.list ?? []);
    return { status: 0, data: { list } };
};

export const parseProfile = (html: string) => parsePublicWorks(extractProfileWorksResponse(html));

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
                link: entry.web_url || `https://www.xinpianchang.com/a${entry.id}`,
                guid: `xinpianchang:${entry.id}`,
                description: entry.content ?? entry.description ?? '',
                pubDate: entry.publish_time ? parseDate(entry.publish_time * 1000) : undefined,
                author: entry.author?.userinfo?.username,
            })),
        '新片场用户作品'
    );

export const parseOriginalWorks = (response: WorksResponse, uid: string) => parsePublicWorks({ ...response, data: { list: (response.data?.list ?? []).filter((entry) => String(entry.author?.userinfo?.id) === uid) } });

export const fetchPublicWorks = async (uid: string): Promise<WorksResponse> => {
    try {
        const apiRes = await ofetch<WorksResponse>(`https://www.xinpianchang.com/api/xpc/v2/user/${uid}/articles`, {
            query: { page: 1, per_page: 20, public_status: 0, order: 'new' },
            responseType: 'json',
        });
        if (apiRes?.status === 0 && (apiRes.data?.list?.length ?? 0) > 0) {
            return apiRes;
        }
    } catch {
        // Fall back to Next.js SSR profile payload when public API is unavailable or empty.
    }
    const html = await ofetch<string>(`https://www.xinpianchang.com/u${uid}`, { parseResponse: (txt) => txt });
    return extractProfileWorksResponse(html);
};

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
        const response = await fetchPublicWorks(uid);
        const item = parsePublicWorks(response);
        return { title: `${item[0].author ?? `新片场用户${uid}`} · 公开作品`, link, item };
    },
};
