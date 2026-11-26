import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.neotalogic.com';

export const parseNeotaLogicBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const seen = new Set<string>();
    const items: DataItem[] = [];

    $('a.bl-card[href], .w-dyn-item a[href^="/blog/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href')?.trim();
        if (!href) {
            return;
        }
        const link = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        if (!link.includes('/blog/') || seen.has(link)) {
            return;
        }
        const title = ($el.find('.bl-card-title, h2, h3').first().text() || $el.attr('title') || '').replaceAll(/\s+/g, ' ').trim();
        if (!title || title.length < 4) {
            return;
        }
        seen.add(link);
        const dateText = $el.find('.bl-card-meta').first().text().replaceAll(/\s+/g, ' ').trim();
        const excerpt = $el.find('.bl-card-excerpt, p').first().text().replaceAll(/\s+/g, ' ').trim();
        const parsed = dateText ? parseDate(dateText) : undefined;

        items.push({
            title,
            link,
            guid: link,
            description: excerpt || title,
            author: 'Neota Logic',
            ...(parsed && !Number.isNaN(parsed.getTime()) ? { pubDate: parsed } : {}),
        });
    });

    return items.slice(0, 30);
};

export const route: Route = {
    path: '/blog',
    name: 'Blog & Legal AI Insights',
    categories: ['new-media'],
    example: '/neotalogic/blog',
    maintainers: ['claude'],
    description: 'Legal AI Insights, News & Resources from Neota Logic.',
    url: 'www.neotalogic.com/blog',
    radar: [{ source: ['www.neotalogic.com/blog', 'neotalogic.com/blog'], target: '/blog' }],
    handler: async () => {
        const link = `${BASE_URL}/blog`;
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseNeotaLogicBlog(html);
        if (!item.length) {
            throw new Error('Neota Logic blog articles were not found');
        }
        return {
            title: 'Neota Logic - Legal AI Insights, News & Resources',
            link,
            item,
        };
    },
};
