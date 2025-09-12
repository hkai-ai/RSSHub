import { Route } from '@/types';
import got from '@/utils/got';
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

interface QwenResearchArticle {
    date: string;
    show_code_copy_buttons: boolean;
    buttons: Array<{
        external: string;
        name: string;
        raw: string;
        attributes: Record<string, unknown>;
        tokens: unknown[];
        href: string;
        label: string;
        type: string;
    }>;
    author: string;
    weight: number;
    show_word_count: boolean;
    readTime: number;
    cover_small: string;
    title: string;
    show_reading_time: boolean;
    tags: string[];
    show_post_nav_links: boolean;
    cover: string;
    word_count: number;
    math: boolean;
    id: string;
    tokenLinks: string;
    show_bread_crumbs: boolean;
    introduction: string;
    draft?: boolean;
}

async function handler() {
    const targetUrl = 'https://qwen.ai/api/page_config?code=research.latest-advancements-list&language=zh-cn';

    const response = await got({
        method: 'get',
        url: targetUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });

    const jsonContent = response.data as QwenResearchArticle[];

    if (!jsonContent || !Array.isArray(jsonContent)) {
        throw new Error('获取Qwen研究文章失败，返回数据格式不正确或为空');
    }

    // 过滤掉草稿文章
    const publishedArticles = jsonContent.filter((article) => !article.draft);

    if (publishedArticles.length === 0) {
        throw new Error('未找到已发布的研究文章');
    }

    const items = publishedArticles.map((article) => {
        const articleUrl = `https://qwen.ai/blog?id=${article.id}&from=research.latest-advancements-list`;

        return {
            title: article.title,
            link: articleUrl,
            description: article.introduction || article.title,
            pubDate: parseDate(article.date),
            author: article.author,
            category: article.tags,
        };
    });

    return {
        title: 'Qwen - 研究最新进展',
        link: 'https://qwen.ai/research',
        description: 'Qwen 研究最新进展 - 最前沿的人工智能研究成果',
        item: items,
    };
}
