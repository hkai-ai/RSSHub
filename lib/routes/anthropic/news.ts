import ofetch from '@/utils/ofetch';
import { DataItem, Route } from '@/types';
import { extractNextFlightObjects } from './next-data';

export const route: Route = {
    path: '/news',
    categories: ['programming'],
    example: '/anthropic/news',
    parameters: {},
    radar: [
        {
            source: ['www.anthropic.com/news', 'www.anthropic.com'],
        },
    ],
    name: 'News',
    maintainers: ['etShaw-zh', 'goestav'],
    handler,
    url: 'www.anthropic.com/news',
};

async function handler() {
    const link = 'https://www.anthropic.com/news';
    const response = await ofetch(link);
    const data = extractNextFlightObjects(response);
    if (data.length === 0) {
        throw new Error('next data is undefined');
    }
    const items: DataItem[] = [];
    for (const chunk of data) {
        if (chunk.page && chunk.page.sections) {
            const sections = chunk.page.sections as any[];
            for (const section of sections) {
                if (section.posts) {
                    const posts = section.posts as any[];
                    for (const post of posts) {
                        const pubDate = new Date(post.publishedOn);
                        const link = 'https://www.anthropic.com/' + post.directories[0].value + '/' + post.slug.current;
                        const description = post.summary;
                        const title = post.title;
                        const image = post.cardPhoto?.url;
                        items.push({
                            pubDate,
                            link,
                            description,
                            title,
                            image,
                        });
                    }
                }
            }
        }
    }
    return {
        title: 'Anthropic News',
        link,
        description: 'Latest news from Anthropic',
        item: items,
    };
}
