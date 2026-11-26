import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://bibigpt.cn';

export const parseBibiGptBlog = (html: string): DataItem[] => {
    const $ = load(html);
    const seen = new Set<string>();
    const items: DataItem[] = [];

    $('a[href*="/zh/blog/posts/"], a[href*="/blog/posts/"]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href')?.trim();
        if (!href) {
            return;
        }
        const link = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        if (seen.has(link)) {
            return;
        }
        const fullText = $a.text().replaceAll(/\s+/g, ' ').trim();
        const title = ($a.find('h1, h2, h3, h4').first().text() || fullText.split(/发布于\s*\d{4}年/)[0] || '').replaceAll(/\s+/g, ' ').trim();
        if (!title || title.length < 4) {
            return;
        }
        seen.add(link);

        const dateMatch = fullText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) || fullText.match(/(\d{4}-\d{2}-\d{2})/);
        const pubDate = dateMatch ? parseDate(dateMatch[2] ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : dateMatch[1]) : undefined;
        const description =
            $a
                .find('p')
                .toArray()
                .map((p) => $(p).text().replaceAll(/\s+/g, ' ').trim())
                .filter((t) => t && !t.startsWith('发布于') && !t.startsWith('阅读全文'))
                .join(' ') || fullText;

        items.push({
            title,
            link,
            guid: link,
            description,
            author: 'BibiGPT',
            ...(pubDate && !Number.isNaN(pubDate.getTime()) ? { pubDate } : {}),
        });
    });

    return items.slice(0, 30);
};

export const route: Route = {
    path: '/blog',
    name: 'Blog & Updates',
    categories: ['blog'],
    example: '/bibigpt/blog',
    maintainers: ['claude'],
    description: 'BibiGPT 中文博客、更新日志与 AI 视频总结指南。',
    url: 'bibigpt.cn/blog',
    radar: [{ source: ['bibigpt.cn/blog', 'bibigpt.cn/zh/blog'], target: '/blog' }],
    handler: async () => {
        const link = `${BASE_URL}/blog`;
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseBibiGptBlog(html);
        if (!item.length) {
            throw new Error('BibiGPT blog articles were not found');
        }
        return {
            title: 'BibiGPT 官方博客',
            link,
            item,
        };
    },
};
