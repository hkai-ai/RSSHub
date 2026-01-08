import type { Data, DataItem, Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

interface ArticleItem {
    articleTitle: string;
    articleUrl: string;
    articlePublishFormattedDate: string;
    articleType: string;
    articleImgUrl?: string;
    articleImgAlt?: string;
    articleDescription?: string;
}

export const route: Route = {
    path: '/press-releases',
    name: '新闻稿',
    categories: ['traditional-media'],
    example: '/infineon/press-releases',
    maintainers: ['claude'],
    radar: [
        {
            source: ['infineon.cn/about/press/press-releases'],
            target: '/press-releases',
        },
    ],
    handler: async (): Promise<Data> => {
        const baseUrl = 'https://www.infineon.cn';
        const apiUrl = `${baseUrl}/content/ifx/zh/about/press/press-releases/jcr:content/root/ifxcontainer_1087892422/insightsarticlenewsl.pagelisting.json`;

        const data = await ofetch<ArticleItem[]>(apiUrl);

        const items: DataItem[] = data.map((article) => {
            const title = article.articleTitle.trim();
            const link = article.articleUrl.startsWith('http') ? article.articleUrl : `${baseUrl}${article.articleUrl}`;

            // Parse date
            let pubDate: Date | undefined;
            if (article.articlePublishFormattedDate) {
                try {
                    pubDate = timezone(parseDate(article.articlePublishFormattedDate, 'MMM DD, YYYY', 'en'), 8);
                    if (Number.isNaN(pubDate.getTime())) {
                        logger.error(`Invalid date parsed for "${article.articlePublishFormattedDate}"`);
                        pubDate = undefined;
                    }
                } catch (error) {
                    logger.error(`Failed to parse date "${article.articlePublishFormattedDate}":`, error);
                }
            }

            // Build description with image
            let description = '';
            if (article.articleImgUrl) {
                description += `<img src="${article.articleImgUrl}" alt="${article.articleImgAlt || 'Article Image'}">`;
            }
            if (article.articleDescription) {
                description += `<br>${article.articleDescription}`;
            }

            return {
                title,
                link,
                description: description || undefined,
                category: article.articleType ? [article.articleType] : undefined,
                pubDate,
            };
        });

        return {
            title: '英飞凌 - 新闻稿',
            link: `${baseUrl}/about/press/press-releases`,
            description: '英飞凌科技新闻稿',
            language: 'zh-CN' as const,
            item: items,
        };
    },
};
