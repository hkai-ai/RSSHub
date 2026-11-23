import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

interface HunyuanDynamicItem {
    id: number;
    content_type?: string;
    title: string;
    content_brief?: string;
    url: string;
    other_info?: string;
    published_at: number;
}

interface HunyuanResearchPublicItem {
    id: number;
    title: string;
    author?: string;
    content?: string;
    customUrl?: string;
    displayPublishTime?: number;
    publishedAt?: number;
    createdAt?: number;
}

export function cleanHunyuanMarkdown(raw = ''): string {
    return raw
        .replace(/@@@coverCard[\s\S]*?(?:@@@|\n\n)/g, '')
        .trim();
}

export function parseHunyuanResearchPublicList(list: HunyuanResearchPublicItem[] = []): DataItem[] {
    return list
        .filter((item) => item && item.title && (item.customUrl || item.id))
        .map((item) => {
            const slug = item.customUrl || String(item.id);
            const ts = item.displayPublishTime || item.publishedAt || item.createdAt;
            const cleaned = cleanHunyuanMarkdown(item.content || '');
            return {
                title: item.title.replace(/\s+/g, ' ').trim(),
                link: `https://hy.tencent.com/research/${slug}`,
                description: cleaned || item.title,
                pubDate: ts ? parseDate(ts, 'X') : undefined,
                author: item.author || 'Tencent Hunyuan',
            };
        });
}

export function parseHunyuanDynamicList(items: HunyuanDynamicItem[] = []): DataItem[] {
    return items
        .filter((item) => item && item.title && item.url)
        .map((item) => ({
            title: item.title.replace(/\s+/g, ' ').trim(),
            link: item.url,
            description: item.content_brief || item.title,
            pubDate: item.published_at ? parseDate(item.published_at, 'X') : undefined,
            author: item.other_info || 'Tencent Hunyuan',
            category: item.content_type ? [item.content_type] : undefined,
        }));
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
            source: ['hy.tencent.com/research', 'hunyuan.tencent.com/news/blog'],
            target: '/hunyuan/blog',
        },
    ],
    name: '腾讯混元博客与研究',
    maintainers: ['claude'],
    handler: async () => {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'X-Source': 'web',
        };

        const [researchRes, dynamicRes] = await Promise.allSettled([
            ofetch('https://api.hunyuan.tencent.com/api/blog/publicList', {
                method: 'POST',
                headers,
                body: {},
            }),
            ofetch('https://api.hunyuan.tencent.com/api/vision_platform/public/auditOpenAPI/dynamic/list', {
                method: 'POST',
                headers,
                body: {
                    page_id: 1,
                    page_size: 20,
                    key: '',
                    order_by: 'published_at',
                    order_dir: 'desc',
                },
            }),
        ]);

        const merged: DataItem[] = [];
        if (researchRes.status === 'fulfilled') {
            const payload = typeof researchRes.value === 'string' ? JSON.parse(researchRes.value) : researchRes.value;
            merged.push(...parseHunyuanResearchPublicList(payload?.data?.list || []));
        }
        if (dynamicRes.status === 'fulfilled') {
            const payload = typeof dynamicRes.value === 'string' ? JSON.parse(dynamicRes.value) : dynamicRes.value;
            merged.push(...parseHunyuanDynamicList(payload?.data?.items || []));
        }

        const unique = [...new Map(merged.map((item) => [item.link, item])).values()].sort((a, b) => {
            const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return tb - ta;
        });

        return {
            title: '腾讯混元研究与官方动态',
            link: 'https://hy.tencent.com/research',
            description: '腾讯混元官方博客与研究动态，发布最新的 AI 模型和技术成果',
            item: unique,
        };
    },
};
