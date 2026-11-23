import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

/** Read the current news entry from the documentation navigation, without pinning a release date. */
export const findDeepSeekNewsPage = (html: string): string | undefined => {
    const $ = load(html);
    const href = $('a[href^="/zh-cn/news/"]').first().attr('href');
    return href ? new URL(href, 'https://api-docs.deepseek.com').href : undefined;
};

export const parseDeepSeekNews = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('aside a[href^="/zh-cn/news/"]').toArray()) {
        const anchor = $(element);
        const href = anchor.attr('href');
        const text = anchor.text();
        const dateText = text.match(/\d{4}\/\d{2}\/\d{2}$/)?.[0];
        if (!href || !dateText) {
            continue;
        }
        const link = new URL(href, 'https://api-docs.deepseek.com').href;
        const date = parseDate(`${dateText.replaceAll('/', '-')}T00:00:00+08:00`);
        if (!Number.isNaN(date.getTime())) {
            items.set(link, { title: text.replace(/\s*\d{4}\/\d{2}\/\d{2}$/, ''), link, pubDate: date });
        }
    }
    return [...items.values()];
};

export const parseDeepSeekArticle = (html: string): string | undefined => {
    const $ = load(html);
    const article = $('.theme-doc-markdown').first();
    article.find('h1, .hash-link').remove();
    return article.html() || undefined;
};

/** Each dated section has a real, stable documentation anchor and becomes one update item. */
export const parseDeepSeekUpdates = (html: string): DataItem[] => {
    const $ = load(html);
    $('.hash-link').remove();
    return $('.theme-doc-markdown h2[id^="date-"]')
        .toArray()
        .flatMap((element): DataItem[] => {
            const heading = $(element);
            const id = heading.attr('id') || '';
            const dateText = id.match(/^date-(\d{4}-\d{2}-\d{2})$/)?.[1];
            if (!dateText) {
                return [];
            }
            const date = parseDate(`${dateText}T00:00:00Z`);
            if (Number.isNaN(date.getTime())) {
                return [];
            }
            const content = heading.nextUntil('h2');
            const title = content.filter('h3').first().text() || heading.text();
            return [
                {
                    title,
                    link: `https://api-docs.deepseek.com/updates#${id}`,
                    pubDate: date,
                    description: content
                        .toArray()
                        .map((node) => $.html(node))
                        .join(''),
                },
            ];
        });
};
