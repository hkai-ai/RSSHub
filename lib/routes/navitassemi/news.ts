import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/news',
    name: '新闻中心',
    categories: ['programming'],
    example: '/navitassemi/news',
    maintainers: ['claude'],
    radar: [
        {
            source: ['navitassemi.com/zh/news-zh/'],
            target: '/news',
        },
    ],
    handler: async () => {
        const url = 'https://navitassemi.com/zh/news-zh/';
        const html = await ofetch(url);
        const $ = load(html);

        const items = $('article.et_pb_post')
            .toArray()
            .map((element) => {
                const $article = $(element);

                // Extract title and link
                const titleElement = $article.find('h2.entry-title a');
                const title = titleElement.text().trim();
                const link = titleElement.attr('href') || '';

                // Extract image
                const image = $article.find('.et_pb_image_container img').attr('src') || '';

                // Extract author
                const author = $article.find('.author.vcard a').text().trim();

                // Extract date
                const dateText = $article.find('span.published').text().trim();
                const pubDate = timezone(parseDate(dateText, 'M 月 D, YYYY'), 0);

                // Extract categories
                const category = $article
                    .find('p.post-meta a[rel="tag"]')
                    .toArray()
                    .map((el) => $(el).text().trim());

                // Extract description
                const description = $article.find('.post-content .post-content-inner p').text().trim();

                return {
                    title,
                    link,
                    description,
                    author,
                    pubDate,
                    category,
                    image,
                };
            });

        return {
            title: 'Navitas Semiconductor - 新闻中心',
            link: url,
            description: 'Navitas Semiconductor 新闻与公告',
            language: 'zh-CN',
            item: items,
        };
    },
};
