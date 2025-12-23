import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/press-releases',
    name: 'Press Releases',
    categories: ['traditional-media'],
    example: '/mahle/press-releases',
    maintainers: ['claude'],
    radar: [
        {
            source: ['newsroom.mahle.com/press/en/press-releases'],
            target: '/press-releases',
        },
    ],
    handler: async () => {
        const baseUrl = 'https://newsroom.mahle.com';
        const url = `${baseUrl}/press/en/press-releases/`;

        const response = await ofetch(url);
        const $ = load(response);

        const items: DataItem[] = [];

        $('.articles a.article').each((_, element) => {
            const $article = $(element);

            const link = baseUrl + $article.attr('href');
            const title = $article.find('h2').text().trim();
            const description = $article.find('.info p').text().trim();
            const dateText = $article.find('.date-cat > div').first().text().trim();
            const image = $article.find('img.background-div').attr('src');

            // Parse date in DD.MM.YYYY format and apply Central European Time (UTC+1)
            const pubDate = timezone(parseDate(dateText, 'DD.MM.YYYY'), +1);

            items.push({
                title,
                link,
                description,
                pubDate,
                image: image ? baseUrl + image : undefined,
            });
        });

        return {
            title: 'MAHLE Newsroom - Press Releases',
            link: url,
            description: 'Latest press releases from MAHLE Group',
            language: 'en',
            item: items,
        };
    },
};
