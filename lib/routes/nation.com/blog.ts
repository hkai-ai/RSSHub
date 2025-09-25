import { Route } from '@/types';
import { config } from '@/config';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

const rootUrl = 'https://www.notion.com';

export const route: Route = {
    path: '/blog',
    name: 'Notion Blog',
    categories: ['programming', 'new-media'],
    example: '/nation.com/blog',
    parameters: {},
    maintainers: ['Claude'],
    handler,
};

async function handler() {
    return await cache.tryGet(
        `${rootUrl}/blog`,
        async () => {
            const response = await ofetch(`${rootUrl}/blog`, {
                headers: {
                    'User-Agent': config.ua,
                },
            });

            const $ = load(response);

            const items: Array<{
                title: string;
                link: string;
                description: string;
                author: string;
                pubDate?: Date;
                category?: string;
            }> = [];

            $('.post-preview').each((_, element) => {
                const $element = $(element);
                const titleElement = $element.find('h3 a');
                const linkElement = $element.find('h3 a');
                const subtitleElement = $element.find('[class*="postPreview_subtitle_"]');
                const authorElement = $element.find('[class*="UserBaseInfo_textInfoContainer_"] p:first-child');
                const eyebrowElement = $element.find('[class*="postPreview_eyebrow_"]');

                const title = titleElement.text().trim();
                const link = `${rootUrl}${linkElement.attr('href')}`;
                const description = subtitleElement.text().trim();
                const author = authorElement.text().trim();
                const category = eyebrowElement.text().trim();

                if (title && link) {
                    items.push({
                        title,
                        link,
                        description,
                        author,
                        category,
                    });
                }
            });

            const detailedItems = await Promise.all(
                items.map((item) =>
                    cache.tryGet(item.link, async () => {
                        try {
                            const articleResponse = await ofetch(item.link, {
                                headers: {
                                    'User-Agent': config.ua,
                                },
                            });

                            const $article = load(articleResponse);
                            const dateElement = $article('time[datetime]');
                            const dateString = dateElement.attr('datetime');

                            let pubDate;
                            if (dateString) {
                                pubDate = parseDate(dateString);
                            }

                            const content = $article('[class*=".contentfulRichText_richText"]').first().html();

                            return {
                                ...item,
                                pubDate,
                                description: content || item.description,
                            };
                        } catch (error) {
                            logger.error(`Failed to fetch article details for ${item.link}:`, error);
                            return item;
                        }
                    })
                )
            );

            return {
                title: 'Notion Blog',
                link: `${rootUrl}/blog`,
                description: 'Latest posts from the Notion Blog',
                item: detailedItems,
            };
        },
        3600
    );
}
