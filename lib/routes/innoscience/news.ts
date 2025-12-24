import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news',
    categories: ['programming'],
    example: '/innoscience/news',
    name: 'News',
    maintainers: ['claude'],
    handler,
    radar: [
        {
            source: ['innoscience.com/news', 'innoscience.com'],
            target: '/news',
        },
    ],
};

interface NewsItem {
    id: string;
    title: string;
    created_time: string;
    updated_time: string;
    url: string;
    picture: string;
    content: string;
    description: string;
}

interface ApiResponse {
    errcode: number;
    msg: string;
    result: {
        total: string;
        models: NewsItem[];
    };
}

async function handler(): Promise<Data> {
    const apiUrl = 'https://www.innoscience.com/search/newsList';

    const responseStr = await ofetch(apiUrl, {
        query: {
            id: '',
            year: '',
            page: '1',
            pagesize: '9',
        },
        responseType: 'text',
    });
    const response = JSON.parse(responseStr) as ApiResponse;
    if (response.errcode !== 0) {
        throw new Error(`API error: ${response.msg}`);
    }

    const items: DataItem[] = await Promise.all(
        response.result.models.map((item) => {
            const link = item.url || `https://www.innoscience.com/site/details/${item.id}`;

            // Parse the content HTML to extract text and clean it up
            const $ = load(item.content);

            // Remove script and style tags
            $('script, style').remove();

            // Get the cleaned HTML content
            const description = $.html().trim();

            // Convert Unix timestamp to Date object
            const pubDate = parseDate(item.updated_time, 'X');

            return {
                title: item.title,
                link,
                description,
                pubDate,
                guid: item.id,
                // Add image if available
                ...(item.picture && {
                    image: item.picture.startsWith('http') ? item.picture : `https://www.innoscience.com${item.picture}`,
                }),
            };
        })
    );

    return {
        title: 'Innoscience - News',
        link: 'https://www.innoscience.com/news',
        description: 'Latest news from Innoscience Technology',
        language: 'en',
        item: items,
    };
}
