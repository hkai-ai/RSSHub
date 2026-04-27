import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { fetchHtmlWithFallback } from '@/utils/browser-crawler';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    categories: ['blog'],
    example: '/langchain/blog',
    radar: [
        {
            source: ['www.langchain.com/blog', 'blog.langchain.dev/'],
        },
    ],
    url: 'www.langchain.com/blog',
    name: 'Blog',
    maintainers: ['liyaozhong'],
    handler,
    description: 'LangChain Blog Posts',
};

async function handler() {
    const rootUrl = 'https://www.langchain.com';
    const currentUrl = `${rootUrl}/blog`;

    const response = await fetchHtmlWithFallback(currentUrl);
    const $ = load(response);

    const items = await Promise.all(
        $('.blog-item.w-dyn-item')
            .toArray()
            .map((item) => {
                const $item = $(item);
                const $link = $item.find('a.blog-link-absolute, a[href*="/blog/"]').first();

                const href = $link.attr('href');
                const title = $item.find('h2').first().text().trim();
                const dateText = $item.find('.date-color').first().text().trim();
                const categories = $item
                    .find('.blog-categories-label')
                    .toArray()
                    .map((el) => $(el).text().trim())
                    .filter(Boolean);
                const authors = $item
                    .find('.blog-author-name-item')
                    .toArray()
                    .map((el) => $(el).text().trim().replace(/,$/, ''))
                    .filter(Boolean);
                const image = $item.find('img.blog-thumbnail, img').first().attr('src');

                if (!href || !title) {
                    return null;
                }

                const link = new URL(href, rootUrl).href;

                return {
                    title,
                    link,
                    pubDate: dateText ? parseDate(dateText) : undefined,
                    category: categories.length > 0 ? categories : undefined,
                    author: authors.length > 0 ? authors.join(', ') : undefined,
                    image: image || undefined,
                    description: title,
                } as DataItem;
            })
            .filter((item): item is DataItem => item !== null)
            .map((item) =>
                cache.tryGet(item.link as string, async () => {
                    try {
                        const detailResponse = await fetchHtmlWithFallback(item.link as string);
                        const $detail = load(detailResponse);

                        const content = $detail('article, [class*="rich-text"], .blog-rich-text, main').first().html();
                        if (content) {
                            item.description = content;
                        }

                        return item as DataItem;
                    } catch {
                        return item;
                    }
                })
            )
    );

    return {
        title: 'LangChain Blog',
        link: currentUrl,
        item: items.filter((item): item is DataItem => item !== null),
    };
}
