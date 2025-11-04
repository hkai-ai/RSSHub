import ofetch from '@/utils/ofetch';
import { DataItem, Route } from '@/types';
import { extractNextFlightObjects } from '@/utils/next-data';

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
        if (chunk.page && chunk.page.sections && chunk.page.sections.length > 0 && chunk.page.sections[0].tabPages) {
            for (const tabPage of chunk.page.sections[0].tabPages) {
                for (const section of tabPage.sections) {
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
    }
    return {
        title: 'Anthropic Research',
        link,
        description: 'Latest research from Anthropic',
        item: items,
    };
}
