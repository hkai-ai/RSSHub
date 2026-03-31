import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['blog'],
    example: '/udio/blog',
    url: 'www.udio.com/blog',
    maintainers: ['claude'],
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
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.udio.com/blog', 'www.udio.com/blog/*'],
            target: '/blog',
        },
    ],
    handler,
    description: 'Udio Blog - Latest news, updates, and articles from Udio, the AI music generation platform.',
};

async function handler() {
    const baseUrl = 'https://www.udio.com';
    const blogUrl = `${baseUrl}/blog`;

    const html = await unlockWebsite(blogUrl);
    const $ = load(html);

    const seen = new Set<string>();
    const items: DataItem[] = [];

    for (const el of $('.saas-featured-article, .saas-article').toArray()) {
        const $el = $(el);
        const title = $el.find('.article-title').first().text().trim();
        const href = $el.find('a[href^="/blog/"]').first().attr('href');

        if (!title || !href || href === '/blog' || href === '/blog/' || href.startsWith('/blog/tags/')) {
            continue;
        }

        const link = new URL(href, baseUrl).href;
        if (seen.has(link)) {
            continue;
        }
        seen.add(link);

        const datetime = $el.find('time[datetime]').first().attr('datetime');
        const pubDate = datetime ? parseDate(datetime) : undefined;

        const tags = $el
            .find('.article-tag span')
            .toArray()
            .map((t) => $(t).text().trim())
            .filter(Boolean);

        const image = $el.find('.article-cover img').first().attr('src');

        items.push({
            title,
            link,
            pubDate,
            category: tags.length > 0 ? tags : undefined,
            image,
        });
    }

    return {
        title: 'Udio Blog',
        link: blogUrl,
        description: 'Latest posts from the Udio Blog',
        language: 'en' as const,
        item: items,
    } satisfies Data;
}
