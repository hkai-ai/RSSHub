import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/global-markets-weekly-update/:date?',
    name: 'Global Markets Weekly Update',
    categories: ['finance', 'new-media'],
    example: '/troweprice/global-markets-weekly-update/2025-09-19',
    maintainers: ['DIYgod'],
    handler: async (ctx) => {
        const { date } = ctx.req.param();
        const baseUrl = date
            ? `https://www.troweprice.com/personal-investing/resources/insights/global-markets-weekly-update.html?date=${date}`
            : 'https://www.troweprice.com/personal-investing/resources/insights/global-markets-weekly-update.html';

        const feed = await cache.tryGet(baseUrl, async () => {
            const response = await ofetch(baseUrl);
            const $ = load(response);

            // Extract publication date from the page
            const dateElement = $('#main-content_body-band-1105586714_personal-investor-body_paragraph-copy-copy .paragraph-contents p').first();
            if (!dateElement.length) {
                logger.error('Date element not found on page');
                throw new Error('Date element not found on page');
            }
            const dateText = dateElement.text();
            if (!dateText.trim()) {
                logger.error('Date element is empty');
                throw new Error('Date element is empty');
            }

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
                link: string;
                pubDate: Date;
            }> = [
                {
                    title: `${title}: ${subtitle}`,
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
