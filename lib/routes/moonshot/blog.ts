import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    categories: ['programming'],
    example: '/moonshot/blog',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '博客',
    maintainers: ['claude-code'],
    handler,
};

async function handler() {
    const baseUrl = 'https://platform.moonshot.cn';
    const blogUrl = `${baseUrl}/blog`;

    const response = await got({
        method: 'get',
        url: blogUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
    });

    const $ = load(response.data);

    const items = $('.post-item')
        .toArray()
        .map((element) => {
            const $item = $(element);
            const $title = $item.find('h3 a');
            const $time = $item.find('time');

            const title = $title.text().trim();
            const link = baseUrl + $title.attr('href');
            const dateTime = $time.attr('datetime');
            const pubDate = dateTime ? parseDate(dateTime) : null;

            return {
                title,
                link,
                pubDate,
                description: title,
            };
        })
        .filter((item) => item.title && item.link);

    return {
        title: 'Moonshot AI - 博客',
        link: blogUrl,
        description: 'Moonshot AI 开放平台博客 - 最新技术动态和产品更新',
        item: items,
    };
}
