import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

interface ArticleContent {
    Title: string;
    Abstract: string;
    TitleKey: string;
    Cover?: string;
}

interface Article {
    ArticleMeta: {
        ArticleType: number;
        Author: string;
        PublishDate: number;
        ResearchArea: Array<{ ResearchAreaNameZh: string }>;
    };
    ArticleSubContentZh: ArticleContent;
    ArticleSubContentEn: ArticleContent;
}

interface ArticleResponse {
    sub_article_list: Article[];
}

export const parsePosts = (data: ArticleResponse): DataItem[] => {
    const items = new Map<string, DataItem>();
    for (const article of data.sub_article_list || []) {
        if (article.ArticleMeta.ArticleType !== 2 || !article.ArticleSubContentZh?.Title) {
            continue;
        }
        const content = article.ArticleSubContentZh;
        // The official site uses the English slug for both languages when available.
        const slug = article.ArticleSubContentEn?.TitleKey || content.TitleKey;
        const pubDate = parseDate(article.ArticleMeta.PublishDate);
        if (!slug || Number.isNaN(pubDate.getTime())) {
            continue;
        }
        const link = new URL(`/zh/blog/${slug}`, 'https://seed.bytedance.com').href;
        items.set(link, {
            title: content.Title,
            link,
            description: content.Abstract,
            pubDate,
            author: article.ArticleMeta.Author || undefined,
            category: article.ArticleMeta.ResearchArea.map((area) => area.ResearchAreaNameZh),
            image: content.Cover || undefined,
        });
    }
    if (!items.size) {
        throw new Error('No ByteDance Seed blog articles found');
    }
    return [...items.values()].toSorted((a, b) => new Date(b.pubDate!).getTime() - new Date(a.pubDate!).getTime());
};

export const handler = async () => ({
    title: 'ByteDance Seed - 最新动态',
    link: 'https://seed.bytedance.com/zh/research',
    description: '字节跳动 Seed 技术博客最新文章',
    item: parsePosts(
        await ofetch('https://seed.bytedance.com/api/get_article_list_v2', {
            query: { article_type: 2, count: 20, page_token: 0, order_desc: true },
        })
    ),
});

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/seed/blog',
    radar: [{ source: ['seed.bytedance.com/zh/research', 'seed.bytedance.com/zh/blog'], target: '/blog' }],
    name: '博客',
    maintainers: ['claude-code'],
    handler,
};
