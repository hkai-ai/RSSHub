import type { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/seed/blog',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '博客',
    maintainers: ['claude-code'],
    handler,
};

interface SeedArticleMeta {
    ID: number;
    ArticleType: number;
    Author: string;
    Status: number;
    PublishDate: number;
    ResearchArea: {
        ResearchAreaID: number;
        ResearchAreaName: string;
        ResearchAreaNameZh: string;
    }[];
    Cover: string;
    Thumbnail: string;
    Journal: string;
    EditorEmail: string;
    UpdateTime: number;
    IsPinned: boolean;
    ContentType: number;
    IsTrending: boolean;
    IsTeamSelect: boolean;
}

interface SeedArticleContentZh {
    Title: string;
    Abstract: string;
    TitleKey: string;
    Cover: string;
    Thumbnail: string;
    VideoLink: string;
    BannerImage: string;
    MobileCover: string;
    HomeCover: string;
    HomeColorMode: number;
}

interface SeedArticle {
    ArticleMeta: SeedArticleMeta;
    ArticleSubContentZh: SeedArticleContentZh;
}

interface RouterData {
    loaderData: {
        '(locale$)/blog/page': {
            article_list: SeedArticle[];
            feedList: SeedArticle[];
            has_more: boolean;
            total: number;
            researchAreaFilter: Record<
                string,
                {
                    ResearchAreaID: number;
                    ResearchAreaName: string;
                    ResearchAreaNameZh: string;
                }
            >;
        };
    };
}

async function handler() {
    const baseUrl = 'https://seed.bytedance.com';
    const blogUrl = `${baseUrl}/zh/blog`;

    const response = await got({
        method: 'get',
        url: blogUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
    });

    const htmlContent = response.data;

    if (!htmlContent || htmlContent.trim() === '') {
        throw new Error('获取字节跳动Seed博客文章的RSS源失败，返回内容为空');
    }

    const routerDataMatch = htmlContent.match(/window\._ROUTER_DATA\s*=\s*({.*?});?\s*(?:<\/script>|$)/s);

    if (!routerDataMatch || !routerDataMatch[1]) {
        throw new Error('未找到 _ROUTER_DATA_ 标签或数据为空');
    }

    const jsonData = routerDataMatch[1];
    let routerData: RouterData;

    try {
        routerData = JSON.parse(jsonData) as RouterData;
    } catch {
        throw new Error('解析 _ROUTER_DATA_ JSON 失败');
    }

    const articles = routerData?.loaderData?.['(locale$)/blog/page']?.article_list;

    if (!articles || !Array.isArray(articles)) {
        throw new Error('未找到文章数组或数据格式不正确');
    }

    const items = articles.map((article) => {
        const articleUrl = `${baseUrl}/zh/blog/${article.ArticleSubContentZh.TitleKey}`;
        const pubDate = parseDate(article.ArticleMeta.PublishDate);

        return {
            title: article.ArticleSubContentZh.Title,
            link: articleUrl,
            description: article.ArticleSubContentZh.Abstract || article.ArticleSubContentZh.Title,
            pubDate,
            author: article.ArticleMeta.Author,
            category: article.ArticleMeta.ResearchArea.map((area) => area.ResearchAreaNameZh),
        };
    });

    return {
        title: 'ByteDance Seed - 最新动态',
        link: blogUrl,
        description: '字节跳动 Seed 技术博客最新文章',
        item: items,
    };
}
