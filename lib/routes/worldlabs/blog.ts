import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['programming'],
    example: '/worldlabs/blog',
    maintainers: ['claude'],
    handler,
    url: 'www.worldlabs.ai/blog',
    radar: [
        {
            source: ['www.worldlabs.ai/blog', 'www.worldlabs.ai/blog/*'],
            target: '/worldlabs/blog',
        },
    ],
};

async function handler() {
    const baseUrl = 'https://www.worldlabs.ai';
    const response = await ofetch(`${baseUrl}/blog`);
    const $ = load(response);

    const items: DataItem[] = $('a[href*="/blog/"], a[href^="http"]')
        .toArray()
        .filter((el) => {
            const $el = $(el);
            // Only pick blog card links that contain an h2 title
            return $el.find('h2').length > 0;
        })
        .map((el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const title = $el.find('h2').text().trim();

            // The first <p> contains date and author
            const metaText = $el.find('p').first().text().trim();
            // Date is before the author name, e.g. "March 3, 2026 World Labs team"
            // Try to extract a date-like prefix
            const dateMatch = metaText.match(/^([A-Z][a-z]+ \d{1,2}, \d{4})/);
            const pubDate = dateMatch ? parseDate(dateMatch[1]) : undefined;
            const author = dateMatch ? metaText.slice(dateMatch[0].length).trim() : metaText;

            // Description is the second <p> (after the meta paragraph)
            const description = $el.find('p').eq(1).text().trim();

            // Image
            const image = $el.find('img').attr('src');

            return {
                title,
                link,
                pubDate,
                author,
                description,
                image,
            } as DataItem;
        })
        .filter((item) => item.title);

    return {
        title: 'World Labs Blog',
        link: `${baseUrl}/blog`,
        description: 'World Labs Blog - Spatial Intelligence Research',
        language: 'en' as const,
        item: items,
    };
}
