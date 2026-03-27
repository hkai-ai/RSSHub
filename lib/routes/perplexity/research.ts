import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://research.perplexity.ai';

export const route: Route = {
    path: '/research',
    example: '/perplexity/research',
    url: 'research.perplexity.ai',
    categories: ['programming'],
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
            source: ['research.perplexity.ai/', 'research.perplexity.ai/articles', 'research.perplexity.ai/articles/*'],
            target: '/research',
        },
    ],
    name: 'Research',
    maintainers: ['claude'],
    handler,
    description: 'Perplexity Research - Frontier research in search, reasoning, agents, and systems.',
};

async function handler() {
    const listUrl = `${baseUrl}/articles`;
    const response = await ofetch(listUrl);
    const $ = load(response);

    const seen = new Set<string>();
    const items: DataItem[] = [];

    $('a[data-framer-name="Work Layout"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || seen.has(href)) {
            return;
        }
        seen.add(href);

        const link = new URL(href, listUrl).href;
        const title = $(el).find('h3, h5, h6').first().text().trim();
        const paragraphs = $(el)
            .find('p')
            .toArray()
            .map((p) => $(p).text().trim())
            .filter(Boolean);
        const uniqueParagraphs = [...new Set(paragraphs)];

        // Pattern: optional category (lowercase word), date (Month Day, Year), description
        const datePattern = /^[A-Z][a-z]+ \d+, \d{4}$/;
        let pubDate: Date | undefined;
        let category: string | undefined;
        let description: string | undefined;

        for (const p of uniqueParagraphs) {
            if (datePattern.test(p)) {
                pubDate = parseDate(p);
            } else if (/^[a-z]+$/.test(p)) {
                category = p;
            } else {
                description = p;
            }
        }

        items.push({
            title,
            link,
            pubDate,
            category: category ? [category] : undefined,
            description,
        });
    });

    const result = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link as string, async () => {
                const articleResponse = await ofetch(item.link as string);
                const $article = load(articleResponse);

                if (!item.pubDate) {
                    const timeEl = $article('time[datetime]').first();
                    if (timeEl.length) {
                        item.pubDate = parseDate(timeEl.attr('datetime')!);
                    }
                }

                const metaDesc = $article('meta[name="description"]').attr('content');
                const infoEl = $article('[data-framer-name="Information"]');
                if (infoEl.length) {
                    // Clean up the HTML content
                    infoEl.find('script, style, noscript').remove();
                    item.description = infoEl.html() ?? metaDesc ?? item.description;
                } else if (metaDesc) {
                    item.description = metaDesc;
                }

                return item;
            })
        )
    );

    return {
        title: 'Perplexity Research',
        link: baseUrl,
        description: 'Perplexity Research - Frontier research in search, reasoning, agents, and systems.',
        language: 'en' as const,
        item: result as DataItem[],
    } satisfies Data;
}
