import { Route } from '@/types';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import ofetch from '@/utils/ofetch';
import cache from '@/utils/cache';
import { config } from '@/config';

export const route: Route = {
    path: '/blog/:tag?',
    name: 'Blog',
    categories: ['programming'],
    example: '/suno/blog',
    parameters: {
        tag: 'Optional tag filter (e.g., "News", "Announcements"). Note: "+" in URL represents space (e.g., "product+update" means "product update")',
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
            source: ['suno.com/blog'],
            target: '/blog',
        },
    ],
    maintainers: ['claude-code'],
    handler: async (ctx) => {
        const { tag } = ctx.req.param();
        const currentUrl = 'https://suno.com/blog';

        return await cache.tryGet(
            currentUrl,
            async () => {
                const response = await ofetch(currentUrl, {
                    headers: {
                        'User-Agent': config.ua,
                    },
                });

                const $ = load(response);
                const scriptContent = $('script#__NEXT_DATA__').html();

                if (!scriptContent) {
                    throw new Error('Could not find __NEXT_DATA__ script');
                }

                const nextData = JSON.parse(scriptContent);
                const { allNews, allPosts } = nextData.props.pageProps;

                // Combine and process both news and posts
                const allItems: Array<{
                    title: string;
                    url: string;
                    date: string;
                    type: string;
                    publication?: { name: string };
                    author?: Array<{ name: string }>;
                    tags?: Array<{ name: string }>;
                    summary?: string;
                    coverImage?: { url: string };
                    thumbnailImage?: { url: string };
                }> = [
                    ...(allNews || []).map((item: any) => ({
                        ...item,
                        type: 'news',
                    })),
                    ...(allPosts || []).map((item: any) => ({
                        ...item,
                        url: `https://suno.com/blog/${item.slug}`,
                        date: item.date || item._firstPublishedAt,
                        type: 'post',
                    })),
                ];

                // Filter by tag if specified and find the original tag name
                let originalTagName: string | null = null;
                const filteredItems = tag
                    ? allItems.filter((item) => {
                          const targetTag = tag.replaceAll('+', ' ').toLowerCase().trim();
                          const matchingTag = item.tags?.find((itemTag) => itemTag.name.toLowerCase() === targetTag);
                          if (matchingTag && !originalTagName) {
                              originalTagName = matchingTag.name;
                          }
                          return !!matchingTag;
                      })
                    : allItems;

                // Sort by date (newest first)
                const sortedItems = filteredItems.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB.getTime() - dateA.getTime();
                });

                const items = sortedItems.slice(0, 20).map((item) => {
                    const pubDate = parseDate(item.date);
                    const author = item.type === 'news' ? item.publication?.name || 'Suno' : item.author?.[0]?.name || 'Suno';

                    const imageUrl = item.coverImage?.url || item.thumbnailImage?.url;

                    return {
                        title: item.title,
                        link: item.url,
                        description: item.summary || item.title,
                        author,
                        pubDate,
                        category: item.tags?.map((tag) => tag.name) || [item.type],
                        ...(imageUrl && {
                            enclosure_url: imageUrl,
                            enclosure_type: 'image/jpeg',
                        }),
                    };
                });

                const displayTag = originalTagName || (tag ? tag.replaceAll('+', ' ') : null);

                const title = displayTag ? `Suno Blog - ${displayTag}` : 'Suno Blog';

                const description = displayTag ? `Latest ${displayTag} posts from Suno - building a future where anyone can make great music` : 'Latest posts from Suno - building a future where anyone can make great music';

                return {
                    title,
                    link: currentUrl,
                    description,
                    item: items,
                };
            },
            1800,
            false
        ); // 30-minute cache
    },
};
