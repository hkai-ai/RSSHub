import { load } from 'cheerio';
import pMap from 'p-map';

import NotFoundError from '@/errors/types/not-found';
import type { DataItem } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { absoluteProductLinks, fetchProductHtml, requireProductItems } from '@/utils/product-updates';

export const parseHelpLinks = (html: string, collectionUrl: string): string[] => {
    const $ = load(html);
    const origin = new URL(collectionUrl).origin;
    return [
        ...new Set(
            $('a[data-testid="article-link"],a.hc-article-link')
                .toArray()
                .flatMap((element) => {
                    const href = $(element).attr('href');
                    if (!href) {
                        return [];
                    }
                    const url = new URL(href, collectionUrl);
                    return url.origin === origin && url.pathname.includes('/articles/') ? [url.href] : [];
                })
        ),
    ];
};

export const parseHelpArticle = (html: string, url: string): DataItem => {
    const $ = load(html);
    const content = $('.article_body,.hc-article').first().clone();
    content.find('h1,time,script,style,nav,footer').remove();
    if (!content.text().trim()) {
        throw new NotFoundError('The help article did not contain a public article body.');
    }
    const date = $('time[datetime]').first().attr('datetime');
    return {
        title: $('h1').first().text().trim(),
        link: url,
        guid: date ? `${url}:updated:${date}` : url,
        description: absoluteProductLinks($, content.html() ?? '', url),
        pubDate: date ? parseDate(date) : undefined,
        updated: date ? parseDate(date) : undefined,
    };
};

export const fetchHelpUpdates = async (collectionUrl: string): Promise<DataItem[]> => {
    const links = parseHelpLinks(await fetchProductHtml(collectionUrl), collectionUrl);
    const items = await pMap(links, (link) => cache.tryGet(link, async () => parseHelpArticle(await fetchProductHtml(link), link), 300), { concurrency: 3 });
    return requireProductItems(items, 'Official help center');
};
