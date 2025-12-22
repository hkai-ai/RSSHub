import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/:types?',
    name: 'News',
    categories: ['journal'],
    example: '/wolterskluwer/news',
    parameters: {
        types: {
            description: 'News type filter, multiple types can be separated by commas',
            options: [
                { value: '', label: 'All news' },
                { value: 'news', label: 'News Page' },
                { value: 'press', label: 'Press Release Page' },
                { value: 'journal', label: 'Journal News Page' },
                { value: 'news,press', label: 'News and Press Releases' },
                { value: 'news,journal', label: 'News and Journal News' },
                { value: 'press,journal', label: 'Press Releases and Journal News' },
                { value: 'news,press,journal', label: 'All three types' },
            ],
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['wolterskluwer.com/en/news', 'wolterskluwer.com/'],
            target: '/news',
        },
    ],
    maintainers: ['claude-code'],
    handler: async (ctx) => {
        const { types = '' } = ctx.req.param();

        // Configure content type filters based on types parameter
        const contentTypeFilters: string[] = [];
        if (types) {
            const typeArray = types.split(',').map((t) => t.trim());
            for (const type of typeArray) {
                switch (type) {
                    case 'news':
                        contentTypeFilters.push('News Page');
                        break;
                    case 'press':
                        contentTypeFilters.push('Press Release Page');
                        break;
                    case 'journal':
                        contentTypeFilters.push('Journal News Page');
                        break;
                    default:
                        break;
                }
            }
        } else {
            // Default: all types
            contentTypeFilters.push('News Page', 'Press Release Page', 'Journal News Page');
        }

        const searchPayload = {
            DatabaseName: '',
            SearchSettingItemId: '',
            Query: '',
            PageSize: 20,
            Page: 0,
            SortBy: {
                FieldName: 'computededitorialrevisiondate_dt',
                Direction: 'Descending',
            },
            ReturnFacetsFields: 'false',
            Filters: [
                {
                    FieldName: 'language_s',
                    Values: ['en'],
                },
                {
                    FieldName: 'contenttype_s',
                    Values: contentTypeFilters,
                },
            ],
            RangeFilters: [],
            Facets: [],
            ProcessKeywordsInQuery: true,
            FieldsToSearchIn: [],
        };

        const cacheKey = `wolterskluwer:news:${types || 'all'}`;

        return await cache.tryGet(
            cacheKey,
            async () => {
                const response = await ofetch('https://www.wolterskluwer.com/api/search', {
                    method: 'POST',
                    headers: {
                        'User-Agent': config.ua,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        Referer: 'https://www.wolterskluwer.com/en/news',
                    },
                    body: JSON.stringify(searchPayload),
                });

                if (!response.Results || response.Results.length === 0) {
                    throw new Error(`No news items found. Response structure: ${JSON.stringify(Object.keys(response))}`);
                }

                const items =
                    response.Results?.map((item: any) => {
                        const title = item.title_txt || 'Untitled';
                        const link = item.url_s ? `https://www.wolterskluwer.com${item.url_s}` : '';
                        const description = item.abstract_txt || '';
                        const pubDate = item.editorialpublishdate_dt ? parseDate(item.editorialpublishdate_dt) : new Date();
                        const category = item.interestarea_facet || item.contenttype_s || '';

                        return {
                            title,
                            link,
                            description,
                            pubDate,
                            category,
                            guid: link || title,
                        };
                    }) || [];

                // Generate title based on selected types
                let feedTitle = 'Wolters Kluwer';
                let descriptionSuffix = 'news';

                if (types) {
                    const typeArray = types.split(',').map((t) => t.trim());
                    const typeLabels: string[] = [];
                    for (const type of typeArray) {
                        switch (type) {
                            case 'news':
                                typeLabels.push('News');
                                break;
                            case 'press':
                                typeLabels.push('Press Releases');
                                break;
                            case 'journal':
                                typeLabels.push('Journal News');
                                break;
                            default:
                                break;
                        }
                    }
                    if (typeLabels.length > 0) {
                        feedTitle += ` ${typeLabels.join(' and ')}`;
                        descriptionSuffix = typeLabels.join(' and ').toLowerCase();
                    } else {
                        feedTitle += ' All News';
                    }
                } else {
                    feedTitle += ' All News';
                }

                return {
                    title: feedTitle,
                    link: 'https://www.wolterskluwer.com/en/news',
                    description: `Latest ${descriptionSuffix} from Wolters Kluwer, a global leader in professional information solutions.`,
                    item: items,
                };
            },
            3600,
            false
        ); // Cache for 1 hour
    },
};
