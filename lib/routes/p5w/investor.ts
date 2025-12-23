import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/investor/:code/notice',
    name: '上市公司公告',
    categories: ['finance'],
    example: '/p5w/investor/301607/notice',
    parameters: {
        code: '股票代码，如 301607',
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
            source: ['rs.p5w.net/investor/:code/notice/last'],
            target: '/investor/:code/notice',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const { code } = ctx.req.param();
        const apiUrl = `https://dataapi.p5w.net/stock/interimAnnouncementList?code=${code}&page=1&pageSize=20`;

        try {
            const response = await ofetch<{
                success: boolean;
                msg: string;
                total: number;
                rows: Array<{
                    s1: number;
                    s2: string;
                    s3: string;
                    s4: string;
                    s5: string;
                    s6: number;
                    s7: string;
                }>;
            }>(apiUrl);

            if (!response.success) {
                throw new Error(response.msg || 'API request failed');
            }

            const items = response.rows.map((item) => ({
                title: item.s3,
                link: item.s2,
                description: item.s3,
                pubDate: parseDate(item.s5),
                category: [item.s7],
                guid: String(item.s1),
            }));

            return {
                title: `全景网 - 上市公司公告 (${code})`,
                link: `https://rs.p5w.net/investor/${code}/notice/last`,
                description: `全景网上市公司 ${code} 的最新公告`,
                item: items,
                language: 'zh-CN',
            };
        } catch (error) {
            logger.error(`Failed to fetch announcements for ${code}:`, error);
            throw error;
        }
    },
};
