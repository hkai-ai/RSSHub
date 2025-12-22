import type { Route } from '@/types';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPage } from '@/utils/puppeteer';

export const route: Route = {
    path: '/information/:cid?',
    name: '全球汽车产业大数据',
    categories: ['new-media'],
    example: '/gasgoo/information/1859528391280168215',
    parameters: {
        cid: '分类ID，见下表，默认为车企分类',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['autodata.gasgoo.com/information/imView/articleList'],
            target: '/information/:cid',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const cid = ctx.req.param('cid') || '1859528391280168215'; // 默认为车企分类

        // 分类映射
        const categoryMap: Record<string, string> = {
            '1859528391280168214': '重大事件',
            '1859528391280168215': '车企',
            '1859528391280168216': '供应链',
            '1859528391280168217': '智能网联',
            '1859528391280168218': '新能源',
            '1859528391280168219': '新技术',
            '1859528391280168220': '政策',
            '1859528391280168221': '销量',
            '1859528391280168222': '财报',
            '1859528391280168223': '人事',
            '1859528391280168224': '创投',
        };

        const categoryName = categoryMap[cid] || '车企';
        const url = `https://autodata.gasgoo.com/information/imView/articleList?t=1&mt=2&cid=${cid}`;

        let apiData: any = null;
        let resolveApiData: (value: any) => void;

        // 创建一个 Promise 用于等待 API 数据
        const apiDataPromise = new Promise<any>((resolve) => {
            resolveApiData = resolve;
        });

        const { destory } = await getPuppeteerPage(url, {
            onBeforeLoad: (page) => {
                // 在页面加载前设置响应拦截器
                page.on('response', async (response) => {
                    const requestUrl = response.url();

                    // 拦截databaseapi.gasgoo.com的请求
                    if (requestUrl.startsWith('https://databaseapi.gasgoo.com/') && !apiData) {
                        try {
                            const contentType = response.headers()['content-type'] || '';
                            if (contentType.includes('application/json')) {
                                const data = await response.json();
                                if (data && (data.data || data.list || data.items || data.result)) {
                                    apiData = data;
                                    logger.info(`Intercepted API response from: ${requestUrl}`);
                                    resolveApiData(data);
                                }
                            }
                        } catch (error) {
                            logger.debug(`Failed to parse response from ${requestUrl}:`, error);
                        }
                    }
                });
            },
        });

        try {
            // 等待 API 数据，最多等待 10 秒
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout waiting for API data')), 10000);
            });

            await Promise.race([apiDataPromise, timeoutPromise]);

            if (!apiData) {
                throw new Error('Failed to intercept API data');
            }

            // 解析API响应数据
            const articles = apiData.data || [];

            const items = articles.map((item: any) => {
                const title = item.title || '';
                const link = `https://autodata.gasgoo.com/information/imView/articleDetails/${item.id}`;
                const description = item.bodyContent || '';

                // 优先使用 publishLongTime (时间戳，更精确)
                let pubDate: Date | undefined;
                if (item.publishLongTime) {
                    pubDate = new Date(Number(item.publishLongTime));
                } else if (item.publishStringTime) {
                    pubDate = parseDate(item.publishStringTime, 'YYYY/MM/DD');
                }

                // 提取标签作为分类
                const categories = [categoryName];
                if (item.tags && Array.isArray(item.tags)) {
                    categories.push(...item.tags.map((tag: any) => tag.labelName));
                }

                return {
                    title,
                    link,
                    description,
                    pubDate,
                    category: categories,
                };
            });

            return {
                title: `盖世汽车 - ${categoryName}`,
                link: url,
                item: items,
                description: `盖世汽车产业大数据 - ${categoryName}分类`,
                language: 'zh-CN',
            };
        } finally {
            await destory();
        }
    },
};
