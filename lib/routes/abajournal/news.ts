import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    categories: ['traditional-media'],
    example: '/abajournal/news',
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
            source: ['abajournal.com/news'],
            target: '/news',
        },
    ],
    name: 'Latest News',
    maintainers: ['your-username'],
    handler,
};

const US_MAINLAND_TZ_OFFSETS = {
    PST: -8, // UTC-8
    PDT: -7, // UTC-7
    MST: -7, // UTC-7（亚利桑那多为全年 MST）
    MDT: -6, // UTC-6
    CST: -6, // UTC-6
    CDT: -5, // UTC-5
    EST: -5, // UTC-5
    EDT: -4, // UTC-4
};

async function handler() {
    const baseUrl = 'https://www.abajournal.com';
    const url = `${baseUrl}/news`;

    const response = await ofetch(url);

    const $ = load(response);
    const items: DataItem[] = [];

    // Parse articles from the specific structure in the HTML
    $('.col-xs-12.col-md-8')
        .find('h3.article_list_headline')
        .each((_, element) => {
            const $headline = $(element);
            const $link = $headline.find('a');
            const title = $link.text().trim();
            let link = $link.attr('href');

            if (!title || !link) {
                return;
            }

            // Handle relative URLs and external links
            if (link.startsWith('/')) {
                link = `${baseUrl}${link}`;
            } else if (!link.startsWith('http')) {
                link = `${baseUrl}/${link}`;
            }

            // Find the category (superscript above headline)
            const $category = $headline.prev('.article_list_superscript');
            const category = $category.text().trim();

            // Find the dateline (after headline)
            const $dateline = $headline.next('.article_list_dateline');
            const dateText = $dateline.text().trim();
            const tz = dateText.slice(Math.max(0, dateText.length - 3));
            // Parse date: format like "Sep 17, 2025 12:04 PM CDT"
            const pubDate = timezone(parseDate(dateText, 'MMM D, YYYY h:mm A', 'en'), US_MAINLAND_TZ_OFFSETS[tz]);
            items.push({
                title,
                link,
                pubDate,
                category: category ? [category] : [],
                guid: link,
            });
        });
    return {
        title: 'ABA Journal - Latest News',
        link: url,
        description: 'Latest news from the American Bar Association Journal',
        item: items,
        language: 'en' as const,
    };
}
