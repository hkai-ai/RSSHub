import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/alignment',
    categories: ['programming'],
    example: '/anthropic/alignment',
    parameters: {},
    radar: [
        {
            source: ['alignment.anthropic.com/'],
            target: '/anthropic/alignment',
        },
    ],
    name: 'Alignment Science Blog',
    maintainers: ['claude'],
    handler,
    url: 'alignment.anthropic.com',
};

async function handler() {
    const baseUrl = 'https://alignment.anthropic.com';
    const response = await ofetch(baseUrl);
    const $ = load(response);

    let currentMonth = '';
    const items: DataItem[] = [];

    const toc = $('.toc');
    toc.children().each((_, el) => {
        const $el = $(el);

        if ($el.hasClass('date')) {
            currentMonth = $el.text().trim();
            return;
        }

        const href = $el.attr('href');
        if (!href) {
            return;
        }

        const title = $el.find('h3').text().trim().replaceAll(/\s+/g, ' ');
        if (!title) {
            return;
        }

        const description = $el.find('.description').text().trim();
        const link = href.startsWith('http') ? href : `${baseUrl}/${href.replace(/^\//, '')}`;
        const pubDate = currentMonth ? timezone(parseDate(currentMonth, 'MMMM YYYY'), 0) : undefined;

        items.push({
            title,
            link,
            description,
            pubDate,
        });
    });

    return {
        title: 'Anthropic Alignment Science Blog',
        link: baseUrl,
        description: 'Research on steering and controlling future powerful AI systems',
        language: 'en' as const,
        item: items as DataItem[],
    };
}
