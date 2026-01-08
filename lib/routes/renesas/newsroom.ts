import { load } from 'cheerio';
import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';

export const route: Route = {
    path: '/newsroom/:type?',
    name: '新闻',
    categories: ['programming'],
    example: '/renesas/newsroom',
    parameters: {
        type: 'News type, `press-release` for press releases, `blog` for blog posts, empty for all',
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
            source: ['renesas.cn/zh/about/newsroom'],
            target: '/newsroom',
        },
        {
            source: ['renesas.cn/zh/blogs'],
            target: '/newsroom/blog',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx: Context): Promise<Data> => {
        const type = ctx.req.param('type');
        const baseUrl = 'https://www.renesas.cn';
        const url = `${baseUrl}/zh/about/newsroom`;

        const response = await ofetch(url);
        const $ = load(response);

        const items: DataItem[] = [];

        // Extract press releases
        if (!type || type === 'press-release') {
            $('#block-latestpressreleases .rcard').each((_, element) => {
                const $element = $(element);
                const title = $element.find('a.rcard__title').text().trim();
                const link = baseUrl + $element.find('a.rcard__title').attr('href');
                const dateAttr = $element.find('time.datetime').attr('datetime');
                const pubDate = dateAttr ? new Date(dateAttr.replace(/Z+$/, 'Z')) : undefined;

                // Get image if available
                const imgSrc = $element.find('a.rcard__image img').attr('src');
                let description = '';
                if (imgSrc) {
                    const fullImgUrl = imgSrc.startsWith('http') ? imgSrc : baseUrl + imgSrc;
                    description = `<img src="${fullImgUrl}" alt="${title}">`;
                }

                items.push({
                    title,
                    link,
                    pubDate,
                    description: description || undefined,
                    category: ['press-release'],
                });
            });
        }

        // Extract blog posts
        if (!type || type === 'blog') {
            $('#block-latestblogposts .rcard').each((_, element) => {
                const $element = $(element);
                const title = $element.find('a.rcard__title').text().trim();
                const link = baseUrl + $element.find('a.rcard__title').attr('href');
                const dateAttr = $element.find('time.datetime').attr('datetime');
                const pubDate = dateAttr ? new Date(dateAttr.replace(/Z+$/, 'Z')) : undefined;

                // Get image if available
                const imgSrc = $element.find('a.rcard__image img').attr('src');
                let description = '';
                if (imgSrc) {
                    const fullImgUrl = imgSrc.startsWith('http') ? imgSrc : baseUrl + imgSrc;
                    description = `<img src="${fullImgUrl}" alt="${title}">`;
                }

                // Add description text if available
                const descText = $element.find('.rcard__description').text().trim();
                if (descText) {
                    description += description ? `<br>${descText}` : descText;
                }

                items.push({
                    title,
                    link,
                    pubDate,
                    description: description || undefined,
                    category: ['blog'],
                });
            });
        }

        const titleMap: Record<string, string> = {
            'press-release': '瑞萨电子 - 新闻发布',
            blog: '瑞萨电子 - 博客',
        };

        return {
            title: type ? titleMap[type] || '瑞萨电子 - 新闻' : '瑞萨电子 - 新闻',
            link: url,
            description: '瑞萨电子新闻与博客',
            language: 'zh-CN' as const,
            item: items,
        };
    },
};
