import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/global-markets-weekly-update',
    name: 'Global Markets Weekly Update',
    categories: ['finance', 'new-media'],
    example: '/troweprice/global-markets-weekly-update',
    maintainers: ['DIYgod'],
    handler: async () => {
        const baseUrl = 'https://www.troweprice.com/personal-investing/resources/insights/global-markets-weekly-update.html';

        const feed = await cache.tryGet(baseUrl, async () => {
            const response = await ofetch(baseUrl);
            const $ = load(response);

            // Extract publication date from the page
            const dateElement = $('#main-content_body-band-1105586714_personal-investor-body_paragraph-copy-copy .paragraph-contents p').first();
            const dateText = dateElement.text();

            // Extract date from format like "markets & economy | september 19, 2025"
            const dateMatch = dateText.match(/\|\s*([a-zA-Z]+)\s+(\d{1,2}),\s*(\d{4})/);
            if (!dateMatch) {
                logger.error('Failed to parse publication date from page. Date text:', dateText);
                throw new Error('Failed to parse publication date from page');
            }

            const [, month, day, year] = dateMatch;
            const dateString = `${month} ${day}, ${year} 8:00 AM`;

            // Parse date
            const parsedDate = parseDate(dateString);
            if (Number.isNaN(parsedDate.getTime())) {
                logger.error('Invalid date format:', dateString);
                throw new Error(`Invalid date format: ${dateString}`);
            }

            const pubDate = timezone(parsedDate, -5); // EST timezone (UTC-5)

            // Extract title
            const title = $('h1.trp-darkest-gray.text-light').text().trim();

            // Extract subtitle
            const subtitle = $('h2.trp-darkest-gray.text-light').first().text().trim();

            // Only add the current week's article
            const items: Array<{
                title: string;
                description: string;
                link: string;
                pubDate: Date;
            }> = [
                {
                    title: `${title}: ${subtitle}`,
                    description: generateDescription($),
                    link: baseUrl,
                    pubDate,
                },
            ];

            return {
                title,
                link: baseUrl,
                description: 'Weekly updates on global market conditions and economic developments from T. Rowe Price',
                item: items,
            };
        });

        return feed;
    },
};

function generateDescription($: any): string {
    let description = '';

    // Add the main title and subtitle
    const title = $('h1.trp-darkest-gray.text-light').text().trim();
    const subtitle = $('h2.trp-darkest-gray.text-light').first().text().trim();

    description += `<h2>${title}</h2>`;
    description += `<h3>${subtitle}</h3>`;

    // Extract content from each section
    const sections = [
        { name: 'U.S.', selector: 'us' },
        { name: 'Europe', selector: 'europe' },
        { name: 'Japan', selector: 'japan' },
        { name: 'China', selector: 'china' },
    ];

    for (const section of sections) {
        const sectionElement = $(`h2#${section.selector}, h3#${section.selector}`).first();
        if (sectionElement.length) {
            description += `<h4>${section.name}</h4>`;

            // Get all paragraphs in this section
            let currentElement = sectionElement.next();
            while (currentElement.length && !currentElement.is('h2, h3')) {
                if (currentElement.is('.paragraph-lg p, .paragraph-md p')) {
                    description += `<p>${currentElement.text().trim()}</p>`;
                }
                currentElement = currentElement.next();
            }
        }
    }

    return description;
}
