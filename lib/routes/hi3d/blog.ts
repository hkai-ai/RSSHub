import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';

const baseUrl = 'https://www.hi3d.ai';

export const parseHi3dBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const items: DataItem[] = [];
    const seen = new Set<string>();

    $('a[href^="/blog/"]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href')?.trim();
        if (!href || href === '/blog/' || href.includes('#') || href.includes('?')) {
            return;
        }
        const link = new URL(href, baseUrl).href;
        if (seen.has(link)) {
            return;
        }
        const title = $a.find('h1, h2, h3, h4').first().text().trim() || $a.text().replaceAll(/\s+/g, ' ').trim();
        if (!title) {
            return;
        }
        seen.add(link);
        const description = $a.find('p').first().text().trim() || undefined;
        items.push({
            title,
            link,
            description,
        });
    });

    return items;
};

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/hi3d/blog',
    maintainers: ['claude'],
    url: 'www.hi3d.ai/blog',
    radar: [
        {
            source: ['www.hi3d.ai/blog', 'blog.hitem3d.ai/blog/atom.xml'],
            target: '/blog',
        },
    ],
    handler: async () => {
        const link = `${baseUrl}/blog`;
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseHi3dBlog(html);
        if (!item.length) {
            throw new Error('No blog articles found on Hi3D blog page');
        }
        return {
            title: 'Hi3D Blog',
            link,
            description: 'Official blog posts from Hi3D (formerly Hitem3D).',
            item,
        };
    },
};
