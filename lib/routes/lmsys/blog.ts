import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.lmsys.org';

const decodeJsonString = (raw: string): string => {
    try {
        return JSON.parse(`"${raw}"`);
    } catch {
        return raw.replaceAll(String.raw`\u0026`, '&').replaceAll(String.raw`\"`, '"');
    }
};

export const parseLmsysBlog = (html: string): DataItem[] => {
    const pattern = /\{\\"slug\\":\\"([^\\"]+)\\",\\"title\\":\\"((?:[^\\"]|\\[^"])*)\\",\\"author\\":\\"((?:[^\\"]|\\[^"])*)\\"[\s\S]*?\\"date\\":\\"([^\\"]+)\\"[\s\S]*?\\"excerpt\\":\\"((?:[^\\"]|\\[^"])*)\\"/g;
    const seen = new Set<string>();
    const items: DataItem[] = [];

    for (const match of html.matchAll(pattern)) {
        const slug = match[1]?.trim();
        const title = decodeJsonString(match[2] ?? '').trim();
        const author = decodeJsonString(match[3] ?? '').trim();
        const dateStr = match[4]?.trim();
        const excerpt = decodeJsonString(match[5] ?? '').trim();

        if (!slug || !title || seen.has(slug)) {
            continue;
        }
        seen.add(slug);

        const link = `${BASE_URL}/blog/${slug}/`;
        const parsed = dateStr ? parseDate(dateStr) : undefined;
        items.push({
            title,
            link,
            guid: link,
            author: author || 'LMSYS Org',
            description: excerpt || title,
            ...(parsed && !Number.isNaN(parsed.getTime()) ? { pubDate: parsed } : {}),
        });
        if (items.length >= 30) {
            break;
        }
    }
    return items;
};

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/lmsys/blog',
    maintainers: ['claude'],
    description: 'Official research and engineering blog posts from LMSYS Org.',
    url: 'lmsys.org/blog/',
    radar: [{ source: ['lmsys.org/blog', 'www.lmsys.org/blog'], target: '/blog' }],
    handler: async () => {
        const link = `${BASE_URL}/blog/`;
        const html = await ofetch<string>(link, { parseResponse: (txt) => txt });
        const item = parseLmsysBlog(html);
        if (!item.length) {
            throw new Error('LMSYS blog articles were not found');
        }
        return {
            title: 'LMSYS Org Blog',
            link,
            item,
        };
    },
};
