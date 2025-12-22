import type { Data, DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/news',
    name: '新闻资讯',
    categories: ['new-media'],
    example: '/d1ev/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['d1ev.com'],
            target: '/news',
        },
    ],
    handler: async () => {
        const apiUrl = 'https://d1ev.com/home/v1004/main/leftNews.do';
        const baseUrl = 'https://www.d1ev.com';

        try {
            const response = await ofetch<{
                code: number;
                desc: string;
                data: {
                    list: Array<{
                        tplId: number;
                        list: Array<{
                            targetId: number;
                            targetType: number;
                            title: string;
                            pcUrl: string;
                            summary: string;
                            source: string;
                            nickName: string;
                            publishDate: number;
                            coverImgUrl: string;
                            likeNums: number;
                            commentNums: number;
                        }>;
                    }>;
                };
            }>(apiUrl, {
                query: {
                    pageSize: 30,
                    pageNumber: 1,
                },
            });

            if (response.code !== 1000 || !response.data?.list) {
                throw new Error(`API returned error: ${response.desc}`);
            }

            // Flatten the nested list structure
            const articles: DataItem[] = [];
            for (const section of response.data.list) {
                for (const article of section.list) {
                    articles.push({
                        title: article.title,
                        link: `${baseUrl}${article.pcUrl}`,
                        description: article.summary || `<img src="${article.coverImgUrl}">`,
                        author: article.nickName,
                        category: [article.source],
                        pubDate: new Date(article.publishDate),
                        guid: String(article.targetId),
                    });
                }
            }

            const data: Data = {
                title: '第1电动 - 新闻资讯',
                link: baseUrl,
                description: '第1电动最新新闻资讯',
                item: articles,
                language: 'zh-CN',
            };

            return data;
        } catch (error) {
            logger.error('Failed to fetch d1ev news:', error);
            throw error;
        }
    },
};
