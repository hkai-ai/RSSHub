import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/quiver/blog',
    maintainers: ['claude'],
    handler,
    url: 'quiver.ai/blog',
    radar: [
        {
            source: ['quiver.ai/blog', 'quiver.ai/blog/*'],
            target: '/quiver/blog',
        },
    ],
};

/**
 * Astro island 把任意值序列化为 [type, value] 元组。
 * 0/1 标量、2 数组、3 对象。原 RSSHub 路由把 `[1, value]` 写死，站点改用 `[0, value]` 后失效。
 * 这里写一个递归 decode，对所有 type 都正确还原。
 */
function decodeAstro(value: unknown): unknown {
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number') {
        return value;
    }
    const [type, payload] = value as [number, unknown];
    switch (type) {
        case 0:
        case 1:
            return payload;

        case 2:
            return Array.isArray(payload) ? payload.map((v) => decodeAstro(v)) : payload;

        case 3:
            if (payload && typeof payload === 'object') {
                const result: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
                    result[k] = decodeAstro(v);
                }
                return result;
            }
            return payload;

        default:
            return payload;
    }
}

async function handler() {
    const baseUrl = 'https://quiver.ai';
    const response = await ofetch(`${baseUrl}/blog`, { parseResponse: (txt) => txt });
    const $ = load(response);

    const island = $('astro-island[component-export="BlogPosts"]');
    const propsRaw = island.attr('props');

    if (!propsRaw) {
        return parseFromHtml($, baseUrl);
    }

    const propsRoot = JSON.parse(propsRaw);
    // 顶层 props 形如 { posts: [type, value] }
    const decoded = decodeAstro([3, propsRoot]) as Record<string, unknown>;
    const posts = (decoded.posts as Array<Record<string, unknown>>) || [];

    if (!Array.isArray(posts) || posts.length === 0) {
        return parseFromHtml($, baseUrl);
    }

    const items: DataItem[] = posts.map((post) => {
        const data = (post.data as Record<string, unknown>) || {};
        const title = (data.title as string) || '';
        const excerpt = (data.excerpt as string) || '';
        const category = data.category as string | undefined;
        const dateStr = data.date as string | undefined;
        const cover = data.cover as string | undefined;
        const slug = (post.id as string) || (post.slug as string) || '';
        const body = (post.body as string) || excerpt;

        return {
            title,
            link: slug ? `${baseUrl}/blog/${slug}` : `${baseUrl}/blog`,
            description: body || excerpt,
            pubDate: dateStr ? parseDate(dateStr) : undefined,
            category: category ? [category] : undefined,
            image: cover ? (cover.startsWith('http') ? cover : `${baseUrl}${cover}`) : undefined,
        };
    });

    // 详情页正文兜底（如果 body 为空且有 link）
    const itemsWithContent = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                if (item.description && (item.description as string).length > 200) {
                    return item;
                }
                try {
                    const resp = await ofetch(item.link as string, { parseResponse: (txt) => txt });
                    const $detail = load(resp);
                    const content = $detail('article').html() || $detail('main').html();
                    if (content) {
                        return { ...item, description: content } as DataItem;
                    }
                } catch {
                    // ignore
                }
                return item;
            })
        )
    );

    return {
        title: 'QuiverAI Blog',
        link: `${baseUrl}/blog`,
        description: 'Latest posts from QuiverAI',
        language: 'en' as const,
        item: itemsWithContent as DataItem[],
    };
}

function parseFromHtml($: ReturnType<typeof load>, baseUrl: string) {
    const items: DataItem[] = $('a[href^="/blog/"]')
        .toArray()
        .filter((el) => {
            const href = $(el).attr('href') || '';
            return href !== '/blog/' && href !== '/blog' && $(el).find('h2').length > 0;
        })
        .map((el) => {
            const a = $(el);
            const link = new URL(a.attr('href') || '', baseUrl).href;
            const title = a.find('h2').first().text().trim();
            const description = a.find('p').first().text().trim();
            const dateText = a
                .find('span')
                .filter((_, span) => /\w+ \d+, \d{4}/.test($(span).text()))
                .first()
                .text()
                .trim();
            const image = a.find('img').first().attr('src');

            return {
                title,
                link,
                description,
                pubDate: dateText ? parseDate(dateText) : undefined,
                image: image ? `${baseUrl}${image}` : undefined,
            };
        })
        .filter((item) => item.title);

    return {
        title: 'QuiverAI Blog',
        link: `${baseUrl}/blog`,
        description: 'Latest posts from QuiverAI',
        language: 'en' as const,
        item: items,
    };
}
