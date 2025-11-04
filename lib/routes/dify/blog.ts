import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/dify/blog',
    radar: [
        {
            source: ['dify.ai/blog'],
            target: '/blog',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const baseUrl = 'https://dify.ai';
        const url = `${baseUrl}/blog`;

        const html = await ofetch(url);
        const $ = load(html);

        interface Article {
            title: string;
            link: string;
            description: string;
            author: string;
            pubDate?: Date;
            image: string;
        }

        const articles: Article[] = [];

        // Parse hero articles (Editor's Choice - top 3 featured articles)
        const heroSection = $('[data-framer-name="Editor\'s Choice"]');
        if (heroSection.length > 0) {
            // Parse 1st featured article
            const first = heroSection.find('[data-framer-name="1st"]').first();
            if (first.length > 0) {
                const link = first.find('a').first();
                const href = link.attr('href');
                if (href) {
                    const title = first.find('[data-framer-name="Title"]').text().trim();
                    const summary = first.find('[data-framer-name="Summary"]').text().trim();
                    const author = first.find('[data-framer-name="Name"]').text().trim();
                    const dateText = first.find('[data-framer-name="Date"]').text().trim();
                    const imgSrc = first.find('img').first().attr('src') || '';

                    let pubDate: Date | undefined;
                    if (dateText) {
                        try {
                            pubDate = timezone(parseDate(dateText, 'MMM DD, YYYY', 'en'), 0);
                        } catch {
                            pubDate = undefined;
                        }
                    }

                    articles.push({
                        title,
                        link: new URL(href, baseUrl).href,
                        description: summary,
                        author,
                        pubDate,
                        image: imgSrc,
                    });
                }
            }

            // Parse 2nd and 3rd featured articles
            for (const frameName of ['2st', '3st']) {
                const article = heroSection.find(`[data-framer-name="${frameName}"]`).first();
                if (article.length > 0) {
                    const link = article.find('a').first();
                    const href = link.attr('href');
                    if (href) {
                        const title = article.find('[data-framer-name="Title"]').text().trim();
                        const summary = article.find('[data-framer-name="Content"]').remove('[data-framer-name="Title"]').text().trim();
                        const author = article.find('[data-framer-name="Name"]').text().trim();
                        const dateText = article.find('[data-framer-name="Date"]').text().trim();
                        const imgSrc = article.find('img').first().attr('src') || '';

                        let pubDate: Date | undefined;
                        if (dateText) {
                            try {
                                pubDate = timezone(parseDate(dateText, 'MMM DD, YYYY', 'en'), 0);
                            } catch {
                                pubDate = undefined;
                            }
                        }

                        articles.push({
                            title,
                            link: new URL(href, baseUrl).href,
                            description: summary,
                            author,
                            pubDate,
                            image: imgSrc,
                        });
                    }
                }
            }
        }

        // Parse article list
        const listSection = $('[data-framer-name="List"]');
        if (listSection.length > 0) {
            const articleCards = listSection.find('a[href^="./blog/"]');
            articleCards.each((_, element) => {
                const $article = $(element);
                const href = $article.attr('href');
                if (href) {
                    const title = $article.find('[data-framer-name="Title"]').text().trim();
                    const summary = $article.find('[data-framer-name="Summary"]').text().trim();
                    const author = $article.find('[data-framer-name="Name"]').text().trim();
                    const dateText = $article.find('[data-framer-name="Date"]').text().trim();
                    const imgSrc = $article.find('img').first().attr('src') || '';

                    let pubDate: Date | undefined;
                    if (dateText) {
                        try {
                            pubDate = timezone(parseDate(dateText, 'MMM DD, YYYY', 'en'), 0);
                        } catch {
                            pubDate = undefined;
                        }
                    }

                    articles.push({
                        title,
                        link: new URL(href, baseUrl).href,
                        description: summary,
                        author,
                        pubDate,
                        image: imgSrc,
                    });
                }
            });
        }

        // Remove duplicates based on link
        const uniqueArticles = articles.filter((article, index, self) => index === self.findIndex((a) => a.link === article.link));

        return {
            title: 'Dify Blog',
            link: url,
            description: 'Latest articles from Dify Blog',
            language: 'en',
            item: uniqueArticles.map((article) => ({
                title: article.title,
                link: article.link,
                description: article.description,
                image: article.image,
                author: article.author,
                pubDate: article.pubDate,
                guid: article.link,
            })),
        };
    },
};
