import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/mac-desk-weekly-recap',
    name: 'MAC Desk Weekly Recap',
    categories: ['finance', 'traditional-media'],
    example: '/nyse/mac-desk-weekly-recap',
    maintainers: ['claude-code'],
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
            source: ['e.nyse.com/mac-desk-weekly-recap'],
            target: '/mac-desk-weekly-recap',
        },
    ],
    handler: async () => {
        const url = 'https://e.nyse.com/mac-desk-weekly-recap';

        try {
            const html = await ofetch(url);
            const $ = load(html);

            let pubDate: Date | undefined;
            let dateParam = '';

            // Find the publication date in the format "Published on MM/DD/YY"
            const dateText = $('div')
                .filter((_, el) => {
                    const text = $(el).text();
                    return text.includes('Published on') && /Published on \d{2}\/\d{2}\/\d{2}/.test(text);
                })
                .text();

            if (dateText) {
                const dateMatch = dateText.match(/Published on (\d{2}\/\d{2}\/\d{2})/);
                if (dateMatch) {
                    dateParam = dateMatch[1];
                    // Parse date from MM/DD/YY format to proper Date object
                    const [month, day, year] = dateParam.split('/');
                    // Assuming years 00-30 are 2000s, 31-99 are 1900s
                    const fullYear = Number.parseInt(year) <= 30 ? `20${year}` : `19${year}`;
                    // Set to 8:00 AM in New York timezone (UTC-5 EST or UTC-4 EDT)
                    const baseDate = parseDate(`${month}/${day}/${fullYear} 08:00`, 'MM/DD/YYYY HH:mm');

                    if (!baseDate || Number.isNaN(baseDate.getTime())) {
                        logger.error(`Failed to parse date: ${dateParam}`);
                        throw new Error(`Invalid publication date format: ${dateParam}`);
                    }

                    pubDate = timezone(baseDate, -5); // New York timezone
                }
            } else {
                logger.error('Publication date not found in page content');
                throw new Error('Publication date not found - page format may have changed');
            }

            // Extract title
            const titleElement = $('h1').first();
            const title = titleElement.text().trim() || 'Weekly Recap';

            // Extract authors
            const authorText = $('div')
                .filter((_, el) => {
                    const text = $(el).text();
                    return text.includes('by ') && (text.includes('Michael Reinking') || text.includes('Eric Criscuolo'));
                })
                .text();
            const author = authorText.replace(/^by\s+/, '').trim() || 'NYSE MAC Desk';

            // Extract market data summary (first paragraph with market numbers)
            const marketDataElement = $('div')
                .filter((_, el) => {
                    const text = $(el).text();
                    return text.includes('DOW') && text.includes('S&P 500');
                })
                .first();
            const marketData = marketDataElement.text().trim();

            // Extract main content
            const contentElements: string[] = [];

            // Get all text content divs, excluding headers and metadata
            $('div').each((_, el) => {
                const $el = $(el);
                const text = $el.text().trim();

                // Skip empty, header, metadata, or navigation elements
                if (
                    !text ||
                    text.length < 50 ||
                    text.includes('Published on') ||
                    text.includes('NYSE MAC Desk') ||
                    text.includes('by Michael Reinking') ||
                    text.includes('Connect with NYSE') ||
                    text.includes('© 2024 Intercontinental Exchange')
                ) {
                    return;
                }

                // Add substantial content paragraphs
                if (text.length > 100) {
                    contentElements.push(text);
                }
            });

            let description = '';
            if (marketData) {
                description += `<strong>Market Summary:</strong><br>${marketData}<br><br>`;
            }

            // Add first few paragraphs of content
            const mainContent = contentElements.slice(0, 3).join('<br><br>');
            description += mainContent;

            // Create the RSS item with date parameter
            const linkWithDate = dateParam ? `${url}?date=${dateParam}` : url;

            const item = {
                title: `NYSE MAC Desk ${title}${dateParam ? ` - ${dateParam}` : ''}`,
                link: linkWithDate,
                description: description || 'NYSE MAC Desk Weekly Market Recap',
                author,
                pubDate: pubDate || new Date(),
                category: ['finance', 'markets', 'trading'],
            };

            return {
                title: 'NYSE MAC Desk Weekly Recap',
                link: url,
                description: 'Weekly market recap from the NYSE MAC Desk trading floor',
                item: [item],
            };
        } catch (error) {
            logger.error(`Failed to fetch NYSE MAC Desk Weekly Recap: ${error}`);
            throw error;
        }
    },
};
