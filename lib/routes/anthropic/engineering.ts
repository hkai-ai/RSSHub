import ofetch from '@/utils/ofetch';
import cache from '@/utils/cache';
import { DataItem, Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { extractNextFlightObjects } from '@/utils/next-data';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/engineering',
    categories: ['programming'],
    example: '/anthropic/engineering',
    radar: [
        {
            source: ['www.anthropic.com/engineering', 'www.anthropic.com'],
        },
    ],
    name: 'Engineering',
    maintainers: ['TonyRL'],
    handler,
    url: 'www.anthropic.com/engineering',
};

async function handler() {
    const baseUrl = 'https://www.anthropic.com';
    const link = `${baseUrl}/engineering`;
    const items = await cache.tryGet(link, async () => {
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
                    if (section.articles) {
                        const articles = section.articles as any[];
                        for (const article of articles) {
                            const pubDate = timezone(parseDate(article.publishedOn), 0);
                            const link = 'https://www.anthropic.com/engineering/' + article.slug.current;
                            const description = article.summary;
                            const title = article.title;
                            const image = article.cardImage?.url;
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
        return items;
    });
    return {
        title: 'Anthropic Engineering',
        link,
        image: `${baseUrl}/images/icons/apple-touch-icon.png`,
        item: items,
    };
}
