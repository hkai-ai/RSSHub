import { load } from 'cheerio';
import Parser from 'rss-parser';

import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export async function parseProducerAnnouncements(xml: string): Promise<DataItem[]> {
    // rss-parser validates XML strictly; Cheerio alone repairs malformed input.
    await new Parser().parseString(xml);
    const $ = load(xml, { xml: true });
    if ($.root().children('rss').length !== 1 || $('rss > channel').length !== 1 || !$('rss > channel > item').length) {
        throw new Error('The official Google Labs response is not the expected nonempty RSS feed');
    }
    const seen = new Set<string>();
    return $('rss > channel > item')
        .toArray()
        .flatMap((element) => {
            const entry = $(element);
            const title = entry.children('title').text();
            const description = entry.children('description').text();
            const link = entry.children('link').text();
            // A bare "Flow" also names Google's video product; it is not a music match.
            if (!/\b(?:flow\s*music|producer\s*ai)\b/i.test(`${title} ${description}`) || !link.startsWith('https://blog.google/') || seen.has(link)) {
                return [];
            }
            seen.add(link);
            const date = entry.children('pubDate').text();
            const author = entry
                .children('author')
                .children('name')
                .toArray()
                .map((name) => $(name).text())
                .join(', ');
            return [{ title, link, description, pubDate: date ? parseDate(date) : undefined, author: author || undefined }];
        });
}
