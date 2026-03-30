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

async function handler() {
    const baseUrl = 'https://quiver.ai';
    const response = await ofetch(`${baseUrl}/blog`, { parseResponse: (txt) => txt });
    const $ = load(response);

    // Blog post data is embedded in an Astro island component's props attribute
    const island = $('astro-island[component-export="BlogPosts"]');
    const propsRaw = island.attr('props');

    if (!propsRaw) {
        // Fallback: parse from HTML directly
        return parseFromHtml($, baseUrl);
    }

    const propsData = JSON.parse(propsRaw);
    // Props structure: { posts: [1, [[0, {id, data, body, slug, ...}], ...]] }
    const postsArray = propsData.posts[1] as Array<[number, Record<string, [number, string | Record<string, [number, string]>]>]>;

    const items: DataItem[] = postsArray.map((entry) => {
        const post = entry[1];
        const data = post.data[1] as Record<string, [number, string]>;
        const title = data.title[1];
        const excerpt = data.excerpt[1];
        const category = data.category[1];
        const dateStr = data.date[1];
        const cover = data.cover[1];
        const slug = (post.slug as [number, string])[1];

        return {
            title,
            link: `${baseUrl}/blog/${slug}`,
            description: excerpt,
            pubDate: parseDate(dateStr),
            category: category ? [category] : undefined,
            image: cover ? `${baseUrl}${cover}` : undefined,
        };
    });

    // Fetch full content for each article
    const itemsWithContent = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const resp = await ofetch(item.link as string, { parseResponse: (txt) => txt });
                const $detail = load(resp);
                const content = $detail('article').html() || $detail('main').html();
                if (content) {
                    return { ...item, description: content };
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
