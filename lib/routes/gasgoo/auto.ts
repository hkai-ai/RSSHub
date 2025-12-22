import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/auto/:category/:section?',
    name: '资讯分类',
    categories: ['new-media'],
    example: '/gasgoo/industry/C-108',
    parameters: {
        category: '分类路径，可在 URL 中找到，如 industry（行业动态）、parts-news（零部件新闻）、nev（新能源）、new-tech（新技术）等',
        section: '板块代码，可在 URL 中找到，如 C-108、C-103、C-501、C-409 等',
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
            source: ['auto.gasgoo.com/:category/:section'],
            target: '/auto/:category/:section',
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const category = ctx.req.param('category') || 'industry';
        const section = ctx.req.param('section') || 'C-108';
        const baseUrl = 'https://auto.gasgoo.com';
        const url = `${baseUrl}/${category}/${section}`;

        const html = await ofetch(url);
        const $ = load(html);

        const items = $('.listArticle .contentList')
            .toArray()
            .map((element) => {
                const $element = $(element);
                const $dl = $element.find('dl');

                // 标题和链接
                const $titleLink = $dl.find('h2.bigtitle a');
                const title = $titleLink.text().trim();
                const relativeLink = $titleLink.attr('href') || '';
                const link = relativeLink.startsWith('http') ? relativeLink : `${baseUrl}${relativeLink}`;

                // 图片
                const $img = $dl.find('dt a img');
                const image = $img.attr('src') || '';

                // 摘要（去除末尾的[详细]链接）
                const $details = $dl.find('p.details');
                // 移除详细链接
                $details.find('a').remove();
                const description = $details.text().trim();

                // 作者
                const author = $dl.find('.authorName').text().trim();

                // 发布时间：格式 "2025-12-22 14:04:20"
                const timeText = $dl.find('.time').text().trim();
                const pubDate = timezone(parseDate(timeText, 'YYYY-MM-DD HH:mm:ss'), 8);

                // 点赞数
                const likes = $dl.find('.likes.num').text().trim();

                // 构建完整的描述（包含图片和点赞数）
                let fullDescription = '';
                if (image) {
                    fullDescription += `<img src="${image}"><br>`;
                }
                fullDescription += description;
                if (likes) {
                    fullDescription += `<br><br>👍 ${likes}`;
                }

                return {
                    title,
                    link,
                    description: fullDescription,
                    author: author || undefined,
                    pubDate,
                };
            })
            .filter((item) => item.title && item.link);

        // 提取页面标题
        const pageTitle = $('title').text().trim() || `盖世汽车 - ${category}/${section}`;

        return {
            title: pageTitle,
            link: url,
            item: items,
            description: `盖世汽车资讯 - ${category}/${section}`,
            language: 'zh-CN',
        };
    },
};
