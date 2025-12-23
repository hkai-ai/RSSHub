import type { DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/news',
    name: '新闻资讯',
    categories: ['traditional-media'],
    example: '/cugroup/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['cugroup.com/About'],
            target: '/news',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://www.cugroup.com';
        const apiUrl = `${baseUrl}/About/newsbypage`;

        // Make POST request to API
        const response = await ofetch(apiUrl, {
            method: 'POST',
            body: 'pageIndex=1&pageSize=20',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const newsData = response.data as Array<{
            Id: string;
            RelativePath: string;
            CreateTime: string;
            MonthEng: string;
            Title: string;
            Blurb: string;
            Year: number;
            Day: number;
        }>;

        // Fetch full content for each article
        const items = await Promise.all(
            newsData.map((item) => {
                const articleLink = `${baseUrl}/Common/Carrierinfo?type=0&id=${item.Id}`;

                try {
                    // Parse timestamp from /Date(1761641798000)/ format
                    const timestamp = Number.parseInt(item.CreateTime.match(/\d+/)?.[0] || '0', 10);
                    const pubDate = new Date(timestamp);
                    return {
                        title: item.Title,
                        link: articleLink,
                        pubDate,
                        image: item.RelativePath,
                    } as DataItem;
                } catch (error) {
                    logger.error(`Failed to fetch detail page ${articleLink}:`, error);

                    // Fallback: parse date from day/month/year
                    const timestamp = Number.parseInt(item.CreateTime.match(/\d+/)?.[0] || '0', 10);
                    const pubDate = new Date(timestamp);

                    return {
                        title: item.Title,
                        link: articleLink,
                        description: item.Blurb,
                        pubDate,
                        image: item.RelativePath,
                    } as DataItem;
                }
            })
        );

        return {
            title: '人本集团 - 新闻资讯',
            link: `${baseUrl}/About?id=4caf3ab3-3187-4862-b808-c8d7e9ec5a2b`,
            description: '人本集团新闻资讯',
            item: items,
            language: 'zh-CN',
        };
    },
};
