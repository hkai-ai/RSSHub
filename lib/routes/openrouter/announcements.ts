import { Route } from '@/types';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import ofetch from '@/utils/ofetch';
import timezone from '@/utils/timezone';

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
    const rootUrl = 'https://openrouter.ai';
    const currentUrl = `${rootUrl}/announcements`;

    const html = await ofetch(currentUrl);
    const $ = load(html);

    const items: Array<{
        title: string;
        link: string;
        description: string;
        pubDate: Date;
    }> = [];

    // Find the main content container
    const mainContent = $('.main-content-container');

    // Find all announcement cards
    mainContent.find('a.group').each((_, element) => {
        const $element = $(element);

        // Extract title from h3
        const title = $element.find('h3').text().trim();

        // Extract link from href attribute
        const link = $element.attr('href');

        // Extract description from p tag
        const description = $element.find('p').text().trim();

        // Extract date from time tag
        const dateText = $element.find('time').text().trim();
        if (title && link) {
            items.push({
                title,
                link: link.startsWith('/') ? `${rootUrl}${link}` : link,
                description,
                pubDate: timezone(parseDate(dateText, ['MM/DD/YYYY', 'M/D/YYYY'])),
            });
        }
    });

    return {
        title: 'OpenRouter Announcements',
        link: currentUrl,
        description: 'Latest announcements from OpenRouter',
        item: items,
    };
}
