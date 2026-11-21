import { type CheerioAPI, load } from 'cheerio';

import NotFoundError from '@/errors/types/not-found';
import type { DataItem } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const fetchProductHtml = (url: string): Promise<string> => ofetch(url, { responseType: 'text', timeout: 25000, retry: 1 });

export const productDate = (text?: string): Date | undefined => {
    const value = text?.match(/(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})/)?.slice(1);
    if (!value) {
        return;
    }
    const result = parseDate(`${value[0]}-${value[1].padStart(2, '0')}-${value[2].padStart(2, '0')}`);
    return Number.isNaN(result.getTime()) ? undefined : result;
};

export const requireProductItems = (items: DataItem[], name: string): DataItem[] => {
    const unique = [...new Map(items.filter((item) => item.title && item.link).map((item) => [item.guid ?? item.link, item])).values()];
    if (!unique.length) {
        throw new NotFoundError(`${name}: no public entries found; the upstream page may have changed or require authentication.`);
    }
    return unique;
};

export const absoluteProductLinks = ($: CheerioAPI, html: string, baseUrl: string): string => {
    const content = $('<div></div>').html(html);
    content.find('script,style,svg,.header-anchor,.anchor').remove();
    content.find('[href],[src]').each((_, element) => {
        for (const attribute of ['href', 'src']) {
            const value = $(element).attr(attribute);
            if (value && !value.startsWith('data:')) {
                try {
                    const url = new URL(value, baseUrl);
                    if (['https:', 'http:'].includes(url.protocol)) {
                        $(element).attr(attribute, url.href);
                    } else {
                        $(element).removeAttr(attribute);
                    }
                } catch {
                    $(element).removeAttr(attribute);
                }
            }
        }
    });
    return content.html() ?? '';
};

export const parseProductSections = (html: string, url: string, selector: string): DataItem[] => {
    const $ = load(html);
    return $(selector)
        .toArray()
        .flatMap((element) => {
            const heading = $(element).clone();
            heading.find('a,svg').remove();
            const title = heading.text().trim();
            const pubDate = productDate(title);
            const anchor = $(element).attr('id');
            if (!pubDate || !anchor) {
                return [];
            }
            const link = `${url}#${encodeURIComponent(anchor)}`;
            const content = $(element)
                .nextUntil(selector)
                .toArray()
                .map((node) => $.html(node))
                .join('');
            return [{ title, link, guid: link, pubDate, description: absoluteProductLinks($, content, url) }];
        });
};
