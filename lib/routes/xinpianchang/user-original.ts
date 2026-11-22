import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Route } from '@/types';

import { fetchPublicWorks, parseOriginalWorks } from './user';

export const route: Route = {
    path: '/user-original/:uid',
    name: '账号本人发布的作品',
    categories: ['new-media'],
    example: '/xinpianchang/user-original/16448630',
    parameters: { uid: '用户主页u后面的数字ID' },
    maintainers: ['hkai-ai'],
    description:
        'Only includes entries whose primary publisher ID matches the requested account. Excludes other creators’ collaboration/producer works and entries without a verifiable publisher ID. Reads the first page of the official public API.',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async (ctx) => {
        const { uid } = ctx.req.param();
        if (!/^\d+$/.test(uid)) {
            throw new InvalidParameterError('Use the numeric user ID.');
        }
        const item = parseOriginalWorks(await fetchPublicWorks(uid), uid);
        return { title: `${item[0].author ?? `新片场用户${uid}`} · 本人发布`, link: `https://www.xinpianchang.com/u${uid}`, item };
    },
};
