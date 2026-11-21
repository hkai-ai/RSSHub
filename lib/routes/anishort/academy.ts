import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { requireProductItems } from '@/utils/product-updates';

interface Tutorial {
    id: number;
    menu_id: number;
    name: string;
    description?: string;
    created_at?: number;
    video_url?: string;
    video_status?: number;
}
interface TutorialResponse {
    code: number;
    data: { list: Array<{ videos: Tutorial[] }> };
}
const link = 'https://anishort.ai/academy';

export const parseTutorials = (response: TutorialResponse) =>
    requireProductItems(
        response.code === 0
            ? response.data.list.flatMap((group) =>
                  group.videos
                      .filter((video) => video.id && video.menu_id === 46 && video.video_status === 0)
                      .map((video) => ({
                          title: video.name,
                          link: `${link}/${video.id}`,
                          guid: `anishort-tutorial:${video.id}`,
                          description: (video.description ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
                          pubDate: video.created_at ? parseDate(video.created_at * 1000) : undefined,
                          enclosure_url: video.video_url,
                          enclosure_type: video.video_url ? 'video/mp4' : undefined,
                      }))
              )
            : [],
        'AniShort官方教程'
    );

export const route: Route = {
    path: '/academy',
    name: '官方教程与新功能',
    categories: ['study'],
    example: '/anishort/academy',
    maintainers: ['hkai-ai'],
    description: '读取官方教程栏目46的首屏数据，包含新功能教学；不是完整版本日志。',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({
        title: 'AniShort 官方教程与新功能',
        link,
        item: parseTutorials(await ofetch<TutorialResponse>('https://anishort.ai/server/sys/products', { query: { menu_id: 46, page_num: 1, page_size: 20, page_group_size: 1 } })),
    }),
};
