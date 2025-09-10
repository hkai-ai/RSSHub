import { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/news/top',
    categories: ['finance'],
    example: '/aastocks/news/top',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '重點新聞',
    maintainers: ['anonymous'],
    handler,
    description: `AASTOCKS 財經新聞 - 重點新聞`,
};

async function handler() {
    const baseUrl = 'http://www.aastocks.com';
    const url = `${baseUrl}/tc/stocks/news/aafn/top-news`;

    const response = await ofetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
    });

    const $ = load(response);

    const items = $('div[ref^="NOW."]')
        .toArray()
        .map((element) => {
            const $element = $(element);

            // 提取標題和鏈接
            const titleElement = $element.find('.newshead4 a').first();
            const title = titleElement.text().trim();
            const link = titleElement.attr('href');

            // 提取時間
            let pubDate = null;
            const timeScript = $element.find('script').text();
            const dateMatch = timeScript.match(/dt:'([^']+)'/);
            if (dateMatch) {
                pubDate = parseDate(dateMatch[1], 'YYYY/MM/DD HH:mm');
            }

            // 提取摘要
            let description = $element.find('.newscontent4').text().trim();

            // 如果沒有摘要，使用標題作為描述
            if (!description) {
                description = title;
            }

            // 提取圖片
            const imageElement = $element.find('img').first();
            const image = imageElement.attr('src');

            // 構建完整鏈接
            const fullLink = link ? (link.startsWith('http') ? link : `${baseUrl}${link}`) : '';

            return {
                title,
                link: fullLink,
                description,
                pubDate,
                image: image || undefined,
            };
        })
        .filter((item) => item.title && item.link);

    return {
        title: 'AASTOCKS 財經新聞 - 重點新聞',
        link: url,
        description: 'AASTOCKS 重點新聞 RSS Feed',
        item: items,
    };
}
