import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/liquid/blog',
    maintainers: ['claude'],
    radar: [
        {
            source: ['www.liquid.ai/company/blog', 'www.liquid.ai/company/blog?category=All'],
            target: '/liquid/blog',
        },
    ],
    handler,
    url: 'www.liquid.ai/company/blog',
};

async function handler() {
    const baseUrl = 'https://www.liquid.ai';
    const blogUrl = `${baseUrl}/company/blog?category=All`;

    const html: string = await ofetch(blogUrl, { parseResponse: (txt: string) => txt });
    const $ = load(html);

    const seen = new Set<string>();
    const items: DataItem[] = [];

    for (const el of $('.research-collection-list-item').toArray()) {
        const card = $(el);
        const a = card.find('a.news-link-block');
        const href = a.attr('href');
        if (!href || seen.has(href)) {
            continue;
        }
        seen.add(href);

        const title = card.find('[fs-cmsfilter-field="title"]').text().trim();
        const category = card.find('[fs-cmsfilter-field="category"]').text().trim();
        const dateText = card.find('.article-meta .eyebrow-small.secondary').text().trim();
        const link = `${baseUrl}${href}`;

        // Parse M.D.YY date format (e.g., "3.5.26" -> March 5, 2026)
        let pubDate: Date | undefined;
        if (dateText) {
            const parts = dateText.split('.');
            if (parts.length === 3) {
                const month = parts[0];
                const day = parts[1];
                const year = Number(parts[2]) < 100 ? `20${parts[2]}` : parts[2];
                pubDate = parseDate(`${year}-${month}-${day}`);
            }
        }

        items.push({
            title,
            link,
            pubDate,
            category: category ? [category] : undefined,
        });
    }

    const itemsWithDescription = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link!, async () => {
                const detailHtml: string = await ofetch(item.link!, { parseResponse: (txt: string) => txt });
                const $detail = load(detailHtml);

                const description = $detail('.rich-text.w-richtext').html();

                // Try to get better date from JSON-LD
                const jsonldScript = $detail('script[type="application/ld+json"]').text();
                if (jsonldScript) {
                    try {
                        const jsonld = JSON.parse(jsonldScript);
                        const blogPosting = jsonld['@graph']?.find((n: Record<string, string>) => n['@type'] === 'BlogPosting');
                        if (blogPosting?.datePublished) {
                            item.pubDate = parseDate(blogPosting.datePublished);
                        }
                    } catch {
                        // ignore parse errors
                    }
                }

                return {
                    ...item,
                    description: description ?? undefined,
                };
            })
        )
    );

    return {
        title: 'Liquid AI Blog',
        link: blogUrl,
        description: 'Find out the latest about Liquid AI.',
        language: 'en' as const,
        item: itemsWithDescription as DataItem[],
    };
}
