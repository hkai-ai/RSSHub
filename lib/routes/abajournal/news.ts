import { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news',
    categories: ['traditional-media'],
    example: '/abajournal/news',
    parameters: {},
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
            source: ['abajournal.com/news'],
            target: '/news',
        },
    ],
    name: 'Latest News',
    maintainers: ['your-username'],
    handler,
};

async function handler() {
    const baseUrl = 'https://www.abajournal.com';
    const url = `${baseUrl}/news`;

    const response = await ofetch(url);

    const $ = load(response);
    const items: DataItem[] = [];

    // Parse articles from the specific structure in the HTML
    $('.col-xs-12.col-md-8')
        .find('h3.article_list_headline')
        .each((_, element) => {
            const $headline = $(element);
            const $link = $headline.find('a');
            const title = $link.text().trim();
            let link = $link.attr('href');

            if (!title || !link) {
                return;
            }

            // Handle relative URLs and external links
            if (link.startsWith('/')) {
                link = `${baseUrl}${link}`;
            } else if (!link.startsWith('http')) {
                link = `${baseUrl}/${link}`;
            }

            // Find the category (superscript above headline)
            const $category = $headline.prev('.article_list_superscript');
            const category = $category.text().trim();

            // Find the dateline (after headline)
            const $dateline = $headline.next('.article_list_dateline');
            const dateText = $dateline.text().trim();

            // Parse date: format like "Sep 17, 2025 12:04 PM CDT"
            let pubDate = new Date();
            if (dateText) {
                try {
                    pubDate = parseDate(dateText);
                } catch {
                    // If parsing fails, use current date
                    pubDate = new Date();
                }
            }

            items.push({
                title,
                link,
                pubDate,
                category: category ? [category] : [],
                guid: link,
            });
        });

    // Get detailed content for each article
    const enrichedItems = await Promise.all(
        items
            .filter((item) => item.link)
            .map((item) =>
                cache.tryGet(
                    item.link!,
                    async () => {
                        try {
                            // Skip external links for content fetching
                            if (!item.link!.includes('abajournal.com')) {
                                return {
                                    ...item,
                                    description: `Category: ${item.category || 'General'}`,
                                };
                            }

                            const articleResponse = await ofetch(item.link!);
                            const $article = load(articleResponse);

                            // Remove unwanted elements
                            $article('script, style, nav, footer, .advertisement, .ad, .sidebar, .masthead, .toolbar').remove();

                            // Try to find article content
                            let content = $article('.article-content').html() || $article('.entry-content').html() || $article('.post-content').html() || $article('.story-body').html() || $article('article .content').html();

                            // If no specific content found, try article body
                            if (!content) {
                                const $articleTag = $article('article');
                                if ($articleTag.length) {
                                    $articleTag.find('nav, footer, .meta, .share, .crumbs, .toolbar').remove();
                                    content = $articleTag.html();
                                }
                            }

                            // Extract author information
                            const author = $article('meta[name="author"]').attr('content') || $article('.author').text().trim() || $article('.byline').text().trim() || $article('[class*="author"]').first().text().trim();

                            // Get more accurate publication date from meta tags
                            const metaDate =
                                $article('meta[property="article:published_time"]').attr('content') ||
                                $article('meta[name="publishdate"]').attr('content') ||
                                $article('meta[name="date"]').attr('content') ||
                                $article('time[datetime]').attr('datetime');

                            if (metaDate) {
                                try {
                                    item.pubDate = parseDate(metaDate);
                                } catch {
                                    // Keep original date if meta date parsing fails
                                }
                            }

                            return {
                                ...item,
                                description: content || `Category: ${item.category || 'General'}`,
                                author: author || undefined,
                            };
                        } catch {
                            // Return basic item if content fetching fails
                            return {
                                ...item,
                                description: `Category: ${item.category || 'General'}`,
                            };
                        }
                    },
                    60 * 60 * 24 * 7
                )
            )
    );

    return {
        title: 'ABA Journal - Latest News',
        link: url,
        description: 'Latest news from the American Bar Association Journal',
        item: enrichedItems.filter((item) => item.title && item.link),
        language: 'en' as const,
    };
}
