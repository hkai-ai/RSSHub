import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/topics/:topic',
    name: 'Topics',
    categories: ['new-media'],
    example: '/globallegalpost/topics/artificial-intelligence',
    parameters: { topic: 'Topic slug, can be found in the URL' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['globallegalpost.com/topics/:topic'],
            target: '/topics/:topic',
        },
    ],
    maintainers: ['claude-code'],
    handler,
};

async function handler(ctx) {
    const { topic } = ctx.req.param();
    const baseUrl = 'https://www.globallegalpost.com';
    const url = `${baseUrl}/topics/${topic}`;

    const response = await cache.tryGet(
        `globallegalpost:topics:${topic}`,
        async () =>
            await ofetch(url, {
                headers: {
                    'User-Agent': 'RSSHUB/1.0',
                },
            }),
        30 * 60 * 1000, // 30 minutes cache
        false
    );

    const $ = load(response);

    const title = $('.archive-title h1').text().trim();
    const description = `Global Legal Post - ${title}`;

    const items = $('.layout_item')
        .not('.post_banner')
        .toArray()
        .map((item) => {
            const $item = $(item);

            const titleElement = $item.find('.alith_post_title a');
            const title = titleElement.text().trim();
            const link = titleElement.attr('href');

            if (!title || !link) {
                return null;
            }

            const fullLink = link.startsWith('http') ? link : `${baseUrl}${link}`;

            const excerpt = $item.find('.alith_post_except').text().trim();
            const imageUrl = $item.find('.layout_item_image img').attr('src');

            const timeText = $item.find('.layout_item_meta_published li').last().text().trim();
            let pubDate = new Date();

            if (timeText.includes('h')) {
                const hours = Number.parseInt(timeText);
                pubDate = new Date(Date.now() - hours * 60 * 60 * 1000);
            } else if (timeText.includes('d')) {
                const days = Number.parseInt(timeText);
                pubDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            } else if (timeText.includes('w')) {
                const weeks = Number.parseInt(timeText);
                pubDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
            } else if (timeText.includes('mo')) {
                const months = Number.parseInt(timeText);
                pubDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);
            }

            let description = excerpt;
            if (imageUrl) {
                description = `<img src="${imageUrl}" alt="${title}" /><br/>${excerpt}`;
            }

            const isSponsored = $item.hasClass('sponsored');
            if (isSponsored) {
                const sponsorTag = $item.find('.layout_item_meta_topics a').text().trim();
                if (sponsorTag) {
                    description += `<br/><em>${sponsorTag}</em>`;
                }
            }

            return {
                title,
                link: fullLink,
                description,
                pubDate,
                guid: fullLink,
            };
        })
        .filter(Boolean);

    return {
        title: `Global Legal Post - ${title}`,
        link: url,
        description,
        item: items,
    };
}
