import { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPageBypass } from '@/utils/puppeteer';
import cache from '@/utils/cache';

const categoryMap = {
    'law-practice-magazine': {
        name: 'Law Practice Magazine',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/law-practice-magazine',
        filter: 'sling_resource_type_s:magazine-article',
    },
    'law-practice-today': {
        name: 'Law Practice Today',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/law-practice-today',
        filter: 'sling_resource_type_s:magazine-article',
    },
    'law-technology-today': {
        name: 'Law Technology Today',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/law-technology-today',
        filter: 'sling_resource_type_s:magazine-article',
    },
    'tech-report': {
        name: 'Tech Report',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/tech-report',
        filter: 'sling_resource_type_s:magazine-article',
    },
    'on-demand': {
        name: 'On-Demand Videos',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/on-demand',
        filter: 'sling_resource_type_s:video',
    },
    podcast: {
        name: 'Law Practice Podcast',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/podcast',
        filter: 'sling_resource_type_s:podcast',
    },
    books: {
        name: 'Books',
        path: '/content/aba-cms-dotorg/en/groups/law_practice/resources/books',
        filter: 'sling_resource_type_s:book',
    },
};

export const route: Route = {
    path: '/law-practice-resources/:category?',
    name: 'Law Practice Resources',
    categories: ['study'],
    example: '/americanbar/law-practice-resources/law-technology-today',
    parameters: {
        category: 'Resource category, see below for available options',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['americanbar.org/groups/law_practice/resources/:category'],
            target: '/law-practice-resources/:category',
        },
    ],
    maintainers: ['nczitzk'],
    handler: async (ctx) => {
        const { category = 'law-technology-today' } = ctx.req.param();

        if (!categoryMap[category]) {
            throw new Error(`Unknown category: ${category}. Available categories: ${Object.keys(categoryMap).join(', ')}`);
        }

        const categoryInfo = categoryMap[category];
        const pageUrl = `https://www.americanbar.org/groups/law_practice/resources/${category}/`;

        const cacheKey = `americanbar:law-practice-resources:${category}`;

        const apiResponse: any = await cache.tryGet(
            cacheKey,
            async () => {
                const { page, destory } = await getPuppeteerPageBypass(pageUrl, {
                    onBeforeLoad: async (page) => {
                        await page.setRequestInterception(true);
                    },
                    gotoConfig: {
                        waitUntil: 'domcontentloaded',
                    },
                });

                let response = null;
                try {
                    await page.waitForResponse(async (res) => {
                        const url = res.url();
                        if (url.includes('.contenttilelist.api')) {
                            response = await res.json();
                            return true;
                        }
                        return false;
                    });
                    return response;
                } finally {
                    await destory();
                }
            },
            10 * 60 * 1000
        ); // 缓存10分钟

        if (!apiResponse || !apiResponse.response || !apiResponse.response.docs) {
            throw new Error('Failed to intercept API response or no data found');
        }

        const items = apiResponse.response.docs.map((item) => {
            const imageUrl = item.imageList?.[0]?.match(/\[([^\s]+)/)?.[1];
            const fullImageUrl = imageUrl ? `https://www.americanbar.org${imageUrl}` : undefined;

            return {
                title: item.pageTitle,
                link: `https://www.americanbar.org${item.pageURL}`,
                description: item.descriptionText,
                author: item.authorNames,
                pubDate: parseDate(item.publishedDate),
                category: item.topics || [],
                image: fullImageUrl,
                guid: item.id,
                extra: {
                    readTime: item.readTime,
                    ribbonText: item.ribbonText,
                    practiceArea: item.practiceAreaAsString,
                    publishingEntity: item.publishingEntityAsStr,
                },
            };
        });

        return {
            title: `ABA ${categoryInfo.name}`,
            link: pageUrl,
            description: `Latest articles from ${categoryInfo.name}`,
            item: items,
        };
    },
};
