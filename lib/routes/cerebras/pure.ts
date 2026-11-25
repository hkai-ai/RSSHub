import { load } from 'cheerio';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export const parseCerebrasNewsroom = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('main a[href]:has(h3)').toArray()) {
        const anchor = $(element);
        const href = anchor.attr('href');
        if (!href) {
            continue;
        }
        const link = new URL(href, 'https://www.cerebras.ai');
        if (!['www.cerebras.ai', 'investors.cerebras.ai'].includes(link.hostname)) {
            continue;
        }
        if (!/^\/(?:blog|press-release|news-releases)\//.test(link.pathname)) {
            continue;
        }
        const title = anchor.find('h3').text();
        if (title) {
            items.set(link.href, { title, link: link.href });
        }
    }
    return [...items.values()];
};

export const parseCerebrasBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();
    for (const element of $('a[href^="/blog/"]').toArray()) {
        const anchor = $(element);
        const href = anchor.attr('href');
        if (!href || href === '/blog/' || href.includes('#') || href.includes('?')) {
            continue;
        }
        const link = new URL(href, 'https://www.cerebras.ai');
        if (link.hostname !== 'www.cerebras.ai' || !link.pathname.startsWith('/blog/')) {
            continue;
        }
        const heading = anchor.find('h1, h2, h3, h4, h5, h6').first().text().trim();
        const rawText = anchor.text().replaceAll(/\s+/g, ' ').trim();
        const dateMatch = rawText.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
        const pubDate = dateMatch ? parseDate(`${dateMatch[1]} UTC`) : undefined;
        const validDate = pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined;
        const fallbackTitle = rawText
            .replace(/([A-Z][a-z]+ \d{1,2}, \d{4})/, '')
            .replace(/\s*Read blog post\s*$/i, '')
            .replace(/\s*>>\s*$/, '')
            .trim();
        const title = heading || fallbackTitle;
        if (!title) {
            continue;
        }
        const existing = items.get(link.href);
        if (!existing || (!existing.pubDate && validDate) || (heading && existing.title !== heading)) {
            items.set(link.href, {
                title,
                link: link.href,
                pubDate: validDate ?? existing?.pubDate,
            });
        }
    }
    return [...items.values()];
};

export const parseCerebrasArticleDate = (html: string): Date | undefined => {
    const $ = load(html);
    const value = $('meta[property="article:published_time"]').attr('content') || $('time[datetime]').attr('datetime') || $('h1').prev('p').text() || $('.field--name-field-nir-news-date').first().text();
    const date = value ? parseDate(/\d{4}-\d{2}-\d{2}T/.test(value) ? value : `${value} UTC`) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
};
