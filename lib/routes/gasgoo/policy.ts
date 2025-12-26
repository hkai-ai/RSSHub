import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

type ArticleData = {
    ArticleId: number;
    Title: string;
    IssueTime: string;
    LinkUrl: string;
    BriefContent: string;
    LogoList: string[];
    ArticleLikesCount: {
        ShowThumbsHits: number;
    };
};

type ApiResponse = {
    d: {
        __type: string;
        Data: ArticleData[];
    };
};

export const route: Route = {
    path: '/policy',
    name: '国家汽车政策资讯',
    categories: ['new-media'],
    example: '/gasgoo/policy',
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
            source: ['auto.gasgoo.com/policy'],
            target: '/policy',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const baseUrl = 'https://auto.gasgoo.com';
        const apiUrl = `${baseUrl}/Policy.aspx/GetArticleList`;

        const response = await ofetch<ApiResponse>(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                Accept: 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                cateName: '',
                keywords: '',
                dept: '',
                year: '',
                district: '',
                pageIndex: 1,
                pageSize: 20,
            }),
        });

        const items = response.d.Data.map((article) => {
            const title = article.Title;
            const link = `${baseUrl}${article.LinkUrl}`;
            const description = article.BriefContent;
            const pubDate = timezone(parseDate(article.IssueTime, 'YYYY-MM-DD HH:mm'), 8);

            // 构建完整的描述（包含图片和点赞数）
            let fullDescription = '';

            // 添加图片
            if (article.LogoList && article.LogoList.length > 0 && article.LogoList[0]) {
                const imageUrl = article.LogoList[0].startsWith('http') ? article.LogoList[0] : `https://imagecn.gasgoo.com/moblogo/News/160_110${article.LogoList[0]}`;
                fullDescription += `<img src="${imageUrl}"><br>`;
            }

            fullDescription += description;

            // 添加点赞数
            if (article.ArticleLikesCount && article.ArticleLikesCount.ShowThumbsHits > 0) {
                fullDescription += `<br><br>👍 ${article.ArticleLikesCount.ShowThumbsHits}`;
            }

            return {
                title,
                link,
                description: fullDescription,
                pubDate,
            };
        });

        return {
            title: '盖世汽车 - 国家汽车政策资讯',
            link: `${baseUrl}/policy/`,
            item: items,
            description: '盖世汽车国家汽车政策资讯',
            language: 'zh-CN',
        };
    },
};
