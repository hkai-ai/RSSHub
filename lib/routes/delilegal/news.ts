import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import timezone from '@/utils/timezone';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/news/:category?/:value?',
    name: '得理新闻资讯',
    url: 'delilegal.com',
    description: '获取得理法律AI平台的最新资讯，包括行业资讯、公司动态和法律知识。',
    categories: ['finance', 'study'],
    example: '/delilegal/news/123',
    parameters: {
        category: {
            description: '新闻分类',
            default: 'all',
            options: [
                { value: 'company', label: '公司动态' },
                { value: 'laws', label: '法律知识' },
            ],
        },
        value: {
            description: '子分类筛选（数字ID）',
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['delilegal.com/news'],
            target: '/delilegal/news',
        },
        {
            source: ['delilegal.com/news/company'],
            target: '/delilegal/news/company',
        },
        {
            source: ['delilegal.com/news/laws'],
            target: '/delilegal/news/laws',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const category = ctx.req.param('category') || 'all';
        const value = ctx.req.param('value');

        // 映射分类到API的type参数
        let apiType = 'industry'; // 默认为行业资讯
        if (category === 'company') {
            apiType = 'company';
        } else if (category === 'laws') {
            apiType = 'literacy';
        }

        // 构建API请求参数
        const requestBody = {
            pageNo: 1,
            pageSize: 10,
            type: apiType,
            category: value || '',
        };
        logger.info(`Fetching delilegal news with parameters:` + JSON.stringify(requestBody));
        const apiUrl = 'https://www.delilegal.com/api/v1/news/query';

        try {
            const response = await ofetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: requestBody,
            });

            if (!response.success || !response.body?.data) {
                logger.warn('API response failed or no data:', response);
                throw new Error('API response failed or no data returned');
            }

            const items = response.body.data.map((item: any) => {
                // 处理发布日期（毫秒时间戳）
                let pubDate = timezone(new Date(), 8);
                if (item.publishDate && typeof item.publishDate === 'number') {
                    try {
                        pubDate = timezone(new Date(item.publishDate), 8);
                    } catch {
                        logger.warn(`Failed to parse publishDate: ${item.publishDate}`);
                    }
                }

                // 构建文章链接 - 使用ID构建详情页URL
                const link = `https://www.delilegal.com/news/${apiType}/${item.id}`;

                return {
                    title: item.title,
                    link,
                    description: item.summary || item.title,
                    category: item.label ? [item.label] : [],
                    pubDate,
                    image: item.pictureUrl,
                };
            });

            // 构建RSS feed信息
            let feedTitle = '得理新闻资讯';
            let feedDescription = '得理法律AI平台的最新资讯';

            if (category === 'company') {
                feedTitle = '得理公司动态';
                feedDescription = '得理法律AI平台的公司动态资讯';
            } else if (category === 'laws') {
                feedTitle = '得理法律知识';
                feedDescription = '得理法律AI平台的法律知识资讯';
            }

            if (value) {
                feedTitle += ` - ${value}`;
                feedDescription += ` (分类: ${value})`;
            }

            return {
                title: feedTitle,
                link: `https://www.delilegal.com/news${category === 'all' ? '' : `/${category}`}${value ? `?value=${value}` : ''}`,
                description: feedDescription,
                language: 'zh-CN',
                item: items,
            };
        } catch (error) {
            logger.error(`Failed to fetch delilegal news from API:`, error);
            throw new Error(`Failed to fetch news from delilegal.com API: ${error}`);
        }
    },
};
