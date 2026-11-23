import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/research',
    categories: ['programming'],
    example: '/qwen/research',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '研究最新进展',
    maintainers: ['claude-code'],
    handler,
};

interface QwenV2Article {
    id: string;
    path?: string;
    title: string;
    content?: string;
    extra?: {
        date?: string;
        author?: string;
        tags?: string[];
        introduction?: string;
        description?: string;
    };
}

interface QwenLegacyArticle {
    id: string;
    date: string;
    author?: string;
    title: string;
    tags?: string[];
    introduction?: string;
    draft?: boolean;
}

export function parseQwenRetrievalArticles(articles: QwenV2Article[] = []): DataItem[] {
    return articles
        .filter((article) => article && article.title && (article.path || article.id))
        .map((article) => {
            const slug = article.path || article.id;
            const dateStr = article.extra?.date;
            return {
                title: article.title.trim(),
                link: `https://qwen.ai/blog?id=${encodeURIComponent(slug)}&from=research.latest-advancements-list`,
                description: article.extra?.introduction || article.extra?.description || article.title,
                pubDate: dateStr ? parseDate(dateStr) : undefined,
                author: article.extra?.author || 'QwenTeam',
                category: article.extra?.tags || [],
            };
        })
        .sort((a, b) => {
            const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return tb - ta;
        });
}

export function parseQwenLegacyArticles(articles: QwenLegacyArticle[] = []): DataItem[] {
    return articles
        .filter((article) => article && !article.draft && article.title && article.id)
        .map((article) => ({
            title: article.title.trim(),
            link: `https://qwen.ai/blog?id=${encodeURIComponent(article.id)}&from=research.latest-advancements-list`,
            description: article.introduction || article.title,
            pubDate: article.date ? parseDate(article.date) : undefined,
            author: article.author || 'QwenTeam',
            category: article.tags || [],
        }));
}

async function handler() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Accept: 'application/json',
    };

    let items: DataItem[] = [];
    try {
        const v2Response = await ofetch('https://qwen.ai/api/v2/article/retrieval?type=qwen_ai&language=zh-CN', {
            headers,
        });
        const v2Payload = typeof v2Response === 'string' ? JSON.parse(v2Response) : v2Response;
        items = parseQwenRetrievalArticles(v2Payload?.data?.articles || []);
    } catch {
        // Fallback to legacy endpoint
    }

    if (items.length === 0) {
        const legacyResponse = await ofetch('https://qwen.ai/api/page_config?code=research.latest-advancements-list&language=zh-cn', {
            headers,
        });
        const legacyPayload = typeof legacyResponse === 'string' ? JSON.parse(legacyResponse) : legacyResponse;
        items = parseQwenLegacyArticles(Array.isArray(legacyPayload) ? legacyPayload : []);
    }

    return {
        title: 'Qwen - 研究最新进展',
        link: 'https://qwen.ai/research',
        description: 'Qwen 研究最新进展 - 最前沿的人工智能研究成果',
        item: items,
    };
}
