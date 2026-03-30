import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['multimedia'],
    example: '/producer/blog',
    maintainers: ['claude'],
    handler,
    url: 'www.producer.ai/blog',
    features: {
        requireConfig: [
            {
                name: 'BRIGHTDATA_API_KEY',
                description: 'Bright Data API key for bypassing anti-bot measures',
            },
            {
                name: 'BRIGHTDATA_UNLOCKER_ZONE',
                description: 'Bright Data zone identifier for web unlocker',
            },
        ],
    },
    radar: [
        {
            source: ['www.producer.ai/blog', 'www.producer.ai/blog/*'],
            target: '/producer/blog',
        },
    ],
};

interface NotionPost {
    properties: {
        Name: { title: Array<{ plain_text: string }> };
        'Publish Date': { date: { start: string } | null };
        Author: { people: Array<{ name: string }> };
        URL: { url: string };
        Tags: { multi_select: Array<{ name: string }> };
    };
    cover: { file: { url: string } } | null;
    snippet: string;
}

async function handler() {
    const baseUrl = 'https://www.producer.ai';

    const html = await unlockWebsite(`${baseUrl}/blog`);
    const $ = load(html);

    const nextData = JSON.parse($('script#__NEXT_DATA__').text());
    const posts = nextData.props.pageProps.posts as NotionPost[];

    const items: DataItem[] = posts.map((post) => {
        const title = post.properties.Name.title.map((t) => t.plain_text).join('');
        const slug = post.properties.URL.url;
        const dateStr = post.properties['Publish Date'].date?.start;
        const author = post.properties.Author.people.map((p) => p.name).join(', ');
        const tags = post.properties.Tags.multi_select.map((t) => t.name);
        const coverUrl = post.cover?.file?.url;

        return {
            title,
            link: `${baseUrl}/blog/${slug}`,
            description: post.snippet,
            pubDate: dateStr ? parseDate(dateStr) : undefined,
            author,
            category: tags.length > 0 ? tags : undefined,
            image: coverUrl ? `${baseUrl}${coverUrl}` : undefined,
        };
    });

    // Fetch full article content from detail pages
    const itemsWithContent = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const detailHtml = await unlockWebsite(item.link as string);
                const $detail = load(detailHtml);
                const content = $detail('article').html();
                if (content) {
                    return { ...item, description: content };
                }
                return item;
            })
        )
    );

    return {
        title: 'Producer.ai Blog',
        link: `${baseUrl}/blog`,
        description: 'News, engineering deep dives, product announcements, and artist showcases from Producer.ai',
        language: 'en' as const,
        item: itemsWithContent as DataItem[],
    };
}
