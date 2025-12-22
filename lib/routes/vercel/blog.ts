import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const handler = async (ctx) => {
    const category = ctx.req.param('category') || 'all';
    const baseUrl = 'https://vercel.com';
    const blogUrl = category === 'all' ? `${baseUrl}/blog` : `${baseUrl}/blog/category/${category}`;

    try {
        const response = await ofetch(blogUrl);
        const $ = load(response);

        const scriptContents = $('script')
            .filter((_, el) => {
                const scriptText = $(el).html() || '';
                return scriptText.includes('self.__next_f.push') && scriptText.includes('initialPosts');
            })
            .toArray();

        if (scriptContents.length === 0) {
            throw new Error('Unable to find blog data');
        }
        let posts: any[] = [];
        for (const content of scriptContents) {
            posts = extractPosts($(content).html()!);
            if (posts && posts.length > 0) {
                break;
            }
        }

        if (!posts.length) {
            throw new Error('No posts found');
        }

        const items = posts.map((post) => ({
            title: post.title || 'Untitled Post',
            link: `${baseUrl}/blog/${post.slug}`,
            author: Array.isArray(post.authors)
                ? post.authors
                      .filter((a) => a?.name)
                      .map((a) => a.name)
                      .join(', ')
                : '',
            category: [post.category?.name || ''],
            pubDate: post.date ? timezone(parseDate(post.date), 0) : undefined,
            guid: post.slug,
        }));

        return {
            title: `Vercel Blog${category === 'all' ? '' : ` - ${category.charAt(0).toUpperCase() + category.slice(1)}`}`,
            link: blogUrl,
            description: `Latest posts from Vercel's blog${category === 'all' ? '' : ` in ${category} category`}`,
            item: items,
            language: 'en-us' as const,
        };
    } catch (error) {
        logger.error(`Error fetching Vercel blog: ${error}`);
        throw error;
    }
};

const unescapeJsonString = (escaped: string) => JSON.parse(`"${escaped}"`);

function extractPosts(scriptContent: string): any[] {
    const postsMap = new Map();

    try {
        // 固定格式：self.__next_f.push([ number, "escaped" ])
        const PUSH_RE = /self\.__next_f\.push\(\[\s*(\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]\)/g;

        let m: RegExpExecArray | null;
        while ((m = PUSH_RE.exec(scriptContent)) !== null) {
            const escaped = m[2];

            // 反转义得到类似：20:["$","$L2b",null,{...}]
            let unescaped: string;
            try {
                unescaped = unescapeJsonString(escaped);
            } catch {
                continue;
            }

            // 取冒号后的 JSON 数组：["$","$L2b",null,{...}]
            const colon = unescaped.indexOf(':');
            if (colon === -1) {
                continue;
            }

            const payloadStr = unescaped.slice(colon + 1).trim();
            const data = JSON.parse(payloadStr);

            for (const subData of data) {
                if (subData && Array.isArray(subData)) {
                    for (const ele of subData.filter((e) => e instanceof Object)) {
                        if (ele.initialPosts) {
                            for (const post of ele.initialPosts) {
                                if (post?.slug) {
                                    postsMap.set(post.slug, post);
                                }
                            }
                        }
                        if (ele.heroPosts) {
                            for (const post of ele.initialPosts) {
                                if (post?.slug) {
                                    postsMap.set(post.slug, post);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        logger.error('Error extracting posts:', error);
    }

    return [...postsMap.values()];
}

export const route: Route = {
    path: '/blog/:category?',
    name: 'Vercel Blog',
    categories: ['programming', 'new-media'],
    example: '/vercel/blog',
    parameters: {
        category: {
            description: 'Blog category filter',
            default: 'all',
            options: [
                { value: 'all', label: 'All Posts' },
                { value: 'engineering', label: 'Engineering' },
                { value: 'community', label: 'Community' },
                { value: 'company-news', label: 'Company News' },
                { value: 'customers', label: 'Customers' },
                { value: 'v0', label: 'v0' },
            ],
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
    },
    radar: [
        {
            source: ['vercel.com/blog', 'vercel.com/blog/category/:category'],
            target: '/vercel/blog/:category',
        },
    ],
    maintainers: ['claude'],
    handler,
};
