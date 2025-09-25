import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { config } from '@/config';

export const route: Route = {
    path: '/expert-insights/:types?',
    name: 'Expert Insights',
    categories: ['journal'],
    example: '/wolterskluwer/expert-insights',
    parameters: {
        types: {
            description: 'Content type filter, multiple types can be separated by commas',
            options: [
                { value: '', label: 'All insights' },
                { value: 'article', label: 'Insight Articles' },
                { value: 'case-study', label: 'Case Studies' },
                { value: 'event', label: 'Events' },
                { value: 'infographic', label: 'Infographics' },
                { value: 'podcast', label: 'Podcasts' },
                { value: 'video', label: 'Videos' },
                { value: 'webinar', label: 'Webinars' },
                { value: 'article,video', label: 'Articles and Videos' },
                { value: 'podcast,webinar', label: 'Podcasts and Webinars' },
                { value: 'article,case-study,video', label: 'Articles, Case Studies and Videos' },
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
            source: ['wolterskluwer.com/en/expert-insights', 'wolterskluwer.com/'],
            target: '/expert-insights',
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
                    case 'article':
                        contentTypeFilters.push('Insight Article Page');
                        break;
                    case 'case-study':
                        contentTypeFilters.push('Insight Case Study Page');
                        break;
                    case 'event':
                        contentTypeFilters.push('Insight Event Page');
                        break;
                    case 'infographic':
                        contentTypeFilters.push('Insight Infographic Page');
                        break;
                    case 'podcast':
                        contentTypeFilters.push('Insight Podcast  Page');
                        break;
                    case 'video':
                        contentTypeFilters.push('Insight Video Page');
                        break;
                    case 'webinar':
                        contentTypeFilters.push('Insight Webinar Page');
                        break;
                    default:
                        break;
                }
            }
        }

        // Always include all content types by default
        if (contentTypeFilters.length === 0) {
            contentTypeFilters.push('Insight Article Page', 'Insight Case Study Page', 'Insight Event Page', 'Insight Infographic Page', 'Insight Podcast  Page', 'Insight Video Page', 'Insight Webinar Page');
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
            ],
            RangeFilters: [],
            Facets: [],
            ProcessKeywordsInQuery: true,
            FieldsToSearchIn: [],
        };

        // Only add content type filter if specific types are requested
        if (contentTypeFilters.length > 0) {
            searchPayload.Filters.push({
                FieldName: 'contenttype_s',
                Values: contentTypeFilters,
            });
        }

        const cacheKey = `wolterskluwer:expert-insights:${types || 'all'}`;

        return await cache.tryGet(
            cacheKey,
            async () => {
                const response = await ofetch('https://www.wolterskluwer.com/api/search', {
                    method: 'POST',
                    headers: {
                        'User-Agent': config.ua,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        Referer: 'https://www.wolterskluwer.com/en/expert-insights',
                    },
                    body: JSON.stringify(searchPayload),
                });

                if (!response.Results || response.Results.length === 0) {
                    throw new Error(`No expert insights found. Response structure: ${JSON.stringify(Object.keys(response))}`);
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
                let feedTitle = 'Wolters Kluwer Expert Insights';
                let descriptionSuffix = 'expert insights';

                if (types) {
                    const typeArray = types.split(',').map((t) => t.trim());
                    const typeLabels: string[] = [];
                    for (const type of typeArray) {
                        switch (type) {
                            case 'article':
                                typeLabels.push('Articles');
                                break;
                            case 'case-study':
                                typeLabels.push('Case Studies');
                                break;
                            case 'event':
                                typeLabels.push('Events');
                                break;
                            case 'infographic':
                                typeLabels.push('Infographics');
                                break;
                            case 'podcast':
                                typeLabels.push('Podcasts');
                                break;
                            case 'video':
                                typeLabels.push('Videos');
                                break;
                            case 'webinar':
                                typeLabels.push('Webinars');
                                break;
                            default:
                                break;
                        }
                    }
                    if (typeLabels.length > 0) {
                        feedTitle = `Wolters Kluwer ${typeLabels.join(' and ')}`;
                        descriptionSuffix = typeLabels.join(' and ').toLowerCase();
                    }
                }

                return {
                    title: feedTitle,
                    link: 'https://www.wolterskluwer.com/en/expert-insights',
                    description: `Latest ${descriptionSuffix} from Wolters Kluwer, a global leader in professional information solutions.`,
                    item: items,
                };
            },
            3600
        ); // Cache for 1 hour
    },
};
