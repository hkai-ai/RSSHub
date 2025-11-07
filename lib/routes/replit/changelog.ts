import { Route } from '@/types';
import { getPuppeteerPage } from '@/utils/puppeteer';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/changelog',
    name: 'Replit Changelog',
    categories: ['programming'],
    example: '/replit/changelog',
    radar: [
        {
            source: ['docs.replit.com/updates'],
            target: '/replit/changelog',
        },
    ],
    maintainers: ['claude'],
    handler: async () => {
        const baseUrl = 'https://docs.replit.com';
        const updatesUrl = `${baseUrl}/updates`;

        // Use Puppeteer to wait for client-side rendering
        const { page, destory } = await getPuppeteerPage(updatesUrl, {
            gotoConfig: {
                waitUntil: 'networkidle2',
            },
        });

        try {
            // Wait for the update list to be rendered
            await page.waitForSelector('li[id^="/updates/"]', { timeout: 10000 });

            // Get the HTML content
            const html = await page.content();
            const $ = load(html);

            // Extract all update links
            const items: Array<{
                title: string;
                link: string;
                pubDate: Date;
                description: string;
            }> = [];

            const seenLinks = new Set<string>();

            $('li[id^="/updates/"]').each((_, element) => {
                const $item = $(element);
                const $link = $item.find('a[href^="/updates/"]');

                const href = $link.attr('href');
                const titleText = $link.find('.flex-1 > div:first-child').text().trim();

                if (href && titleText) {
                    const fullUrl = `${baseUrl}${href}`;

                    // Skip duplicates
                    if (seenLinks.has(fullUrl)) {
                        return;
                    }
                    seenLinks.add(fullUrl);

                    // Parse date from title (e.g., "October 31, 2025")
                    const pubDate = timezone(parseDate(titleText, 'MMMM D, YYYY', 'en'), 0);

                    items.push({
                        title: titleText,
                        link: fullUrl,
                        pubDate,
                        description: `Replit update for ${titleText}`,
                    });
                }
            });

            // Sort by date descending
            items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

            return {
                title: 'Replit Changelog',
                link: updatesUrl,
                description: 'Latest updates and changelog from Replit',
                item: items,
            };
        } finally {
            // Always clean up Puppeteer resources
            await destory();
        }
    },
};
