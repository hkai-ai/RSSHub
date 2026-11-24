import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const rootUrl = 'https://openrouter.ai';
const announcementsUrl = `${rootUrl}/blog/announcements/`;

export const parseAnnouncements = (html: string): DataItem[] => {
    const $ = load(html);
    const items = new Map<string, DataItem>();

    // Current layout: /blog/announcements/<slug>/ cards
    $('a[href^="/blog/announcements/"], a[href^="https://openrouter.ai/blog/announcements/"]').each((_, element) => {
        const $element = $(element);
        const href = $element.attr('href');
        if (!href) {
            return;
        }
        const url = new URL(href, rootUrl);
        if (url.pathname === '/blog/announcements/' || url.pathname === '/blog/announcements') {
            return;
        }

        const title = $element.find('h1, h2, h3, h4').first().text().trim();
        const description = $element.find('p').first().text().trim();
        const $time = $element.find('time').first();
        const dateText = ($time.attr('datetime') || $time.text()).trim();
        const pubDate = dateText ? parseDate(dateText) : undefined;

        if (title && !items.has(url.href)) {
            items.set(url.href, {
                title,
                link: url.href,
                description,
                pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : undefined,
            });
        }
    });

    // Legacy layout fallback
    if (!items.size) {
        $('.main-content-container a.group').each((_, element) => {
            const $element = $(element);
            const title = $element.find('h3').text().trim();
            const link = $element.attr('href');
            const description = $element.find('p').text().trim();
            const dateText = $element.find('time').text().trim();
            if (title && link) {
                const fullLink = link.startsWith('/') ? `${rootUrl}${link}` : link;
                items.set(fullLink, {
                    title,
                    link: fullLink,
                    description,
                    pubDate: timezone(parseDate(dateText, ['MM/DD/YYYY', 'M/D/YYYY'])),
                });
            }
        });
    }

    if (!items.size) {
        throw new Error('No OpenRouter announcements found');
    }

    return [...items.values()].toSorted((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
};

export const route: Route = {
    path: '/announcements',
    categories: ['programming'],
    example: '/openrouter/announcements',
    parameters: {},
    features: {
        requireConfig: [],
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'OpenRouter Announcements',
    maintainers: ['claude'],
    handler,
};

async function handler() {
    const html = await ofetch(announcementsUrl);

    return {
        title: 'OpenRouter Announcements',
        link: announcementsUrl,
        description: 'Latest announcements from OpenRouter',
        item: parseAnnouncements(html),
    };
}
