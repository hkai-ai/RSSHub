import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const ROOT_URL = 'https://bfl.ai';

const MONTH_DATE_RE = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s*\d{4}\b/i;

export function parseBflBlogList(html: string): DataItem[] {
    const $ = load(html);
    const byUrl = new Map<string, DataItem>();

    $('a[href^="/blog/"]').each((_, anchorElement) => {
        const $anchor = $(anchorElement);
        const relativeLink = $anchor.attr('href')?.trim();
        if (!relativeLink || relativeLink === '/blog' || relativeLink === '/blog/') {
            return;
        }
        const link = relativeLink.startsWith('http') ? relativeLink : `${ROOT_URL}${relativeLink}`;

        const $card = $anchor.find('article').first().length ? $anchor.find('article').first() : $anchor;
        const title = $card.find('h1, h2, h3, h4').first().text().replace(/\s+/g, ' ').trim();
        if (!title || title.length < 3) {
            return;
        }

        let pubDate: Date | undefined;
        const $time = $card.find('time').first();
        const datetimeAttr = $time.attr('datetime')?.trim();
        if (datetimeAttr) {
            pubDate = parseDate(datetimeAttr);
        } else {
            const cardText = $card.text().replace(/\s+/g, ' ').trim();
            const match = cardText.match(MONTH_DATE_RE);
            if (match) {
                pubDate = parseDate(`${match[0]} UTC`);
            }
        }

        const summary = $card.find('p').first().text().replace(/\s+/g, ' ').trim();

        if (!byUrl.has(link)) {
            byUrl.set(link, {
                title,
                link,
                description: summary || title,
                author: 'Black Forest Labs',
                pubDate,
            });
        }
    });

    return [...byUrl.values()];
}

const fetchDescription = (item: DataItem): Promise<DataItem> =>
    cache.tryGet(item.link!, async () => {
        try {
            const detailPageHtml = await ofetch(item.link!);
            const $detailPage = load(detailPageHtml);
            const detailContentSelector = 'article, main article, div.max-w-4xl.mx-auto.px-6, div.max-w-3xl.mx-auto.px-6, .blog-content';
            const fullDescription = $detailPage(detailContentSelector).first().html()?.trim();

            return {
                ...item,
                description: fullDescription || item.description,
            };
        } catch {
            return item;
        }
    });

async function handler(): Promise<Data> {
    const listPageUrl = `${ROOT_URL}/blog`;
    const listPageHtml = await ofetch(listPageUrl);
    const $ = load(listPageHtml);

    const feedTitle = $('head title').text().trim() || 'BFL AI Blog';
    const feedDescription = $('head meta[name="description"]').attr('content')?.trim() || 'Latest blog posts from Black Forest Labs (bfl.ai).';

    const preliminaryItems = parseBflBlogList(listPageHtml);
    const items: DataItem[] = await Promise.all(preliminaryItems.map((item) => fetchDescription(item)));

    return {
        title: feedTitle,
        link: listPageUrl,
        description: feedDescription,
        item: items,
        language: 'en',
    };
}

export const route: Route = {
    path: '/blog',
    categories: ['multimedia'],
    example: '/bfl/blog',
    parameters: {},
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
            source: ['bfl.ai/blog'],
            target: '/blog',
            title: 'Blog',
        },
    ],
    name: 'Blog',
    maintainers: ['thirteenkai'],
    handler,
    url: 'bfl.ai/blog',
    description: 'Fetches the latest blog posts from Black Forest Labs (bfl.ai). Provides full article content by default with caching.',
};
