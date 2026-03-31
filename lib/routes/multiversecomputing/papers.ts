import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://multiversecomputing.com';
const sanityApi = 'https://ls8k7ser.api.sanity.io/v2024-01-01/data/query/production';

export const route: Route = {
    path: '/papers',
    name: 'Papers',
    categories: ['programming'],
    example: '/multiversecomputing/papers',
    maintainers: ['claude'],
    radar: [
        {
            source: ['multiversecomputing.com/papers'],
            target: '/multiversecomputing/papers',
        },
    ],
    handler,
    url: 'multiversecomputing.com/papers',
};

async function handler() {
    const query = `*[_type == "paper" && published == true] | order(publishedAt desc) [0...50] { title, slug, publishedAt, brief }`;
    const data = await ofetch(sanityApi, {
        query: { query },
    });

    const papers = data.result as Array<{
        title: string;
        slug: { current: string };
        publishedAt: string;
        brief: string;
    }>;

    const list: DataItem[] = papers.map((paper) => ({
        title: paper.title,
        link: `${baseUrl}/papers/${paper.slug.current}`,
        description: paper.brief,
        pubDate: parseDate(paper.publishedAt),
    }));

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link as string, async () => {
                try {
                    const detailResponse = await ofetch(item.link as string);
                    const $ = load(detailResponse);
                    const content = $('article').html();
                    return {
                        ...item,
                        description: content || item.description,
                    } as DataItem;
                } catch (error) {
                    logger.error(`Failed to fetch detail for "${item.title}":`, error);
                    return item;
                }
            })
        )
    );

    return {
        title: 'Multiverse Computing - Papers',
        link: `${baseUrl}/papers`,
        description: 'Latest publications from Multiverse Computing',
        language: 'en' as const,
        item: items as DataItem[],
    };
}
