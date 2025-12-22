import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    url: 'https://www.superlegal.ai/blog/',
    maintainers: ['RSSHub'],
    example: '/superlegal/blog',
    parameters: {},
    description: 'Superlegal Blog - Insights on closing deals faster and scaling legal process',
    categories: ['programming', 'blog'],

    async handler() {
        const baseUrl = 'https://www.superlegal.ai';
        const url = `${baseUrl}/blog/`;

        const html = await ofetch(url);
        const $ = load(html);

        const items = $('.sl-reg_post')
            .toArray()
            .map((item) => {
                const $item = $(item);

                // Extract the main link
                const link = $item.find('a').first().attr('href') || '';

                // Extract title from .sl-reg_post_content
                const title = $item.find('.sl-reg_post_content').text().trim();

                // Extract description from .sl-post-intro
                const description = $item.find('.sl-post-intro').text().trim();

                // Extract author from .sl-reg_post_author and remove "by " prefix
                const authorText = $item.find('.sl-reg_post_author').text().trim();
                const author = authorText.startsWith('by ') ? authorText.slice(3) : authorText;

                // Extract date from .sl-reg_post_date
                const dateText = $item.find('.sl-reg_post_date').text().trim();
                const pubDate = parseDate(dateText);

                // Extract image
                const image = $item.find('.item-image-container img').attr('src') || '';

                return {
                    title,
                    link: link.startsWith('http') ? link : baseUrl + link,
                    description: description + (image ? `<br><img src="${image}" alt="${title}">` : ''),
                    author,
                    pubDate,
                    guid: link,
                };
            })
            .filter((item) => item.title && item.link);

        return {
            title: 'Superlegal Blog',
            link: url,
            description: 'Insights on closing deals faster and scaling legal process, from the people making it happen.',
            item: items,
        };
    },
};
