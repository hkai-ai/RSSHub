import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { extractNextFlightObjects } from './next-data';

export const route: Route = {
    path: '/research',
    categories: ['programming'],
    example: '/anthropic/research',
    parameters: {},
    radar: [
        {
            source: ['www.anthropic.com/research', 'www.anthropic.com'],
        },
    ],
    name: 'Research',
    maintainers: ['ttttmr'],
    handler,
    url: 'www.anthropic.com/research',
};

async function handler() {
    const link = 'https://www.anthropic.com/research';
    const response = await ofetch(link);
    const data = extractNextFlightObjects(response);
    if (data.length === 0) {
        throw new Error('next data is undefined');
    }
    const items: DataItem[] = [];
    for (const chunk of data) {
        if (chunk.page?.sections) {
            for (const section of chunk.page.sections) {
                if (section.posts) {
                    const posts = section.posts as any[];
                    for (const post of posts) {
                        const pubDate = new Date(post.publishedOn);
                        const postLink = 'https://www.anthropic.com/' + post.directories[0].value + '/' + post.slug.current;
                        items.push({
                            pubDate,
                            link: postLink,
                            description: post.summary,
                            title: post.title,
                            image: post.cardPhoto?.url || post.illustration?.url,
                        });
                    }
                }
            }
        }
    }
    return {
        title: 'Anthropic Research',
        link,
        description: 'Latest research from Anthropic',
        item: items,
    };
}
