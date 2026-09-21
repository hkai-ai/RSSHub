import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { ViewType } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog/:category?',
    name: 'Blog',
    url: 'cognition.com/blog',
    maintainers: ['Loongphy', 'ttttmr'],
    example: '/cognition/blog',
    categories: ['programming'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['cognition.com/blog', 'cognition.com/blog/:slug', 'cognition.ai/blog'],
            target: '/blog',
        },
        {
            source: ['cognition.ai/blog/1', 'cognition.ai/blog/:category/1'],
            target: '/blog/:category?',
        },
    ],
    view: ViewType.Articles,
    handler,
    parameters: {
        category: 'Category name, e.g., Research, Tutorials',
    },
};

const splitAuthors = (text: string | undefined): DataItem['author'] => {
    if (!text) {
        return undefined;
    }

    const names = text
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

    if (names.length === 0) {
        return undefined;
    }

    return names.map((name) => ({
        name,
    }));
};

export async function handler(ctx) {
    const baseUrl = 'https://cognition.com';
    const { category } = ctx.req.param();
    const listPath = category ? `/blog/${category}/1` : '/blog';
    const targetUrl = new URL(listPath, baseUrl).href;
    const html = await ofetch(targetUrl);
    const $ = load(html);

    const seen = new Set<string>();
    const items = $('main li:has(a[href^="/blog/"] h2), #blog-post-list__list li.blog-post-list__list-item')
        .toArray()
        .map((el) => {
            const element = $(el);
            const linkElement = element.find('a[href^="/blog/"], a.o-blog-preview').first();

            const href = linkElement.attr('href');
            const link = href ? new URL(href, baseUrl).href : undefined;

            if (!link || seen.has(link)) {
                return;
            }

            const title = linkElement.find('h2, h3.o-blog-preview__title').first().text();
            if (!title) {
                return;
            }

            const summary = linkElement.find('p').first().html();

            const dateNode = linkElement.find('.o-blog-preview__meta-date').clone();
            dateNode.find('.o-blog-preview__meta').remove();
            const dateText = dateNode.text().trim() || linkElement.find('span').first().text().trim();
            const authorText = linkElement.find('.o-blog-preview__meta-author').text().trim();

            const dataItem: DataItem = {
                title,
                link,
                pubDate: /^\d{2}\.\d{2}\.\d{2}$/.test(dateText) ? parseDate(dateText + ' +0000', 'MM.DD.YY ZZ') : parseDate(dateText),
            };

            if (summary) {
                dataItem.description = summary;
            }

            const authors = splitAuthors(authorText);
            if (authors) {
                dataItem.author = authors;
            }

            seen.add(link);
            return dataItem;
        })
        .filter((item): item is DataItem => item !== undefined);

    if (items.length === 0) {
        throw new Error(`No Cognition blog articles found at ${targetUrl}; check the list page structure`);
    }

    const imageAttr = $('meta[property="og:image"]').attr('content');
    const image = imageAttr ? new URL(imageAttr, baseUrl).href : undefined;

    return {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content'),
        link: targetUrl,
        item: items,
        image,
    };
}
