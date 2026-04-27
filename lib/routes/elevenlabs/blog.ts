import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'ElevenLabs Blog',
    url: 'elevenlabs.io/blog',
    description: 'ElevenLabs Blog - Voice AI research and deployment updates',
    categories: ['programming', 'new-media'],
    example: '/elevenlabs/blog',
    maintainers: ['your-github-username'],
    handler: async () => {
        const baseUrl = 'https://elevenlabs.io';
        const currentUrl = `${baseUrl}/blog`;

        return await cache.tryGet(
            currentUrl,
            async () => {
                const response = await fetchHtmlWithFallback(currentUrl);
                const $ = load(response);

                const pageTitle = $('title').text() || 'ElevenLabs Blog';
                const pageDescription = $('meta[name="description"]').attr('content') || 'ElevenLabs Blog - Voice AI research and deployment updates';

                // 列表已迁移到 Next.js + Tailwind，原 `article.card` 失效。
                // 用结构选择器：每篇文章是 `article`，含 `h2 > a[href^="/blog/"]`，且有 `time[datetime]`。
                const articles: Array<{
                    title: string;
                    link: string;
                    description: string;
                    category: string;
                    pubDate?: Date;
                    image: string;
                }> = [];

                $('article').each((_, element) => {
                    const $article = $(element);
                    const $titleLink = $article.find('h2 a[href^="/blog/"]').first();
                    const href = $titleLink.attr('href');
                    if (!href) {
                        return;
                    }
                    const title = $titleLink.text().trim();
                    if (!title) {
                        return;
                    }

                    const fullLink = href.startsWith('http') ? href : `${baseUrl}${href}`;

                    // 摘要：仅 featured 卡有
                    const description = $article.find('p.tw-text-gray-500, p.tw-text-light').first().text().trim();

                    // 分类：dd 第一项
                    const category = $article.find('dl dd').first().text().trim();

                    // 日期：time[datetime] 属性更稳定
                    let pubDate: Date | undefined;
                    const timeEl = $article.find('time[datetime]').first();
                    const datetime = timeEl.attr('datetime');
                    if (datetime) {
                        pubDate = parseDate(datetime);
                    }

                    // 图片：_next/image 代理 URL 也可直接拿
                    let image = '';
                    const imgEl = $article.find('img').first();
                    const imgSrc = imgEl.attr('src');
                    if (imgSrc) {
                        image = imgSrc.startsWith('http') ? imgSrc : `${baseUrl}${imgSrc}`;
                    }

                    articles.push({
                        title,
                        link: fullLink,
                        description: description || title,
                        category,
                        pubDate,
                        image,
                    });
                });

                // 兜底：补抓详情页内容
                const items: DataItem[] = (await Promise.all(
                    articles.map((article) =>
                        cache.tryGet(article.link, async () => {
                            const item: DataItem = {
                                title: article.title,
                                link: article.link,
                                description: article.description,
                                category: article.category ? [article.category] : undefined,
                                pubDate: article.pubDate,
                                image: article.image || undefined,
                            };

                            try {
                                const articleResponse = await fetchHtmlWithFallback(article.link);
                                const $detail = load(articleResponse);

                                if (!item.pubDate) {
                                    const datetime = $detail('time[datetime]').first().attr('datetime');
                                    if (datetime) {
                                        item.pubDate = parseDate(datetime);
                                    }
                                }

                                const fullDescription = $detail('article, [class*="prose"], main').first().html();
                                if (fullDescription && fullDescription.length > (typeof item.description === 'string' ? item.description.length : 0)) {
                                    item.description = fullDescription;
                                }
                            } catch (error) {
                                logger.error(`Failed to fetch article details for ${article.link}:`, error);
                            }

                            return item;
                        })
                    )
                )) as DataItem[];

                return {
                    title: pageTitle,
                    link: currentUrl,
                    description: pageDescription,
                    item: items,
                };
            },
            900,
            false
        );
    },
};
