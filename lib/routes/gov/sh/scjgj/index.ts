import { load } from 'cheerio';

import type { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const handler = async () => {
    const { data: response } = await got('https://scjgj.sh.gov.cn/1073/index.html');
    const $ = load(response);

    const language = $('html').prop('lang') || 'zh';

    const items = $('.table_list tr:not(:first-child)')
        .toArray()
        .map((item) => {
            const element = $(item);
            const titleElement = element.find('td').eq(2).find('a');
            const dateElement = element.find('td').eq(3);

            const title = titleElement.attr('title') || titleElement.text().trim();
            const relativeLink = titleElement.attr('href');
            const link = relativeLink ? new URL(relativeLink, 'https://scjgj.sh.gov.cn').href : '';
            const pubDate = dateElement.text().trim();

            return {
                title,
                link,
                pubDate: timezone(parseDate(pubDate), +8),
                language,
            };
        })
        .filter((item) => item.title && item.link);

    const author = '上海市市场监督管理局';
    const title = '行政处罚公示';
    const description = '上海市市场监督管理局行政处罚决定书公示';

    return {
        title: `${author} - ${title}`,
        description,
        link: 'https://fw.scjgj.sh.gov.cn/shaic/punish!getList.action',
        item: items,
        allowEmpty: true,
        language,
        author,
    };
};

export const route: Route = {
    path: '/sh/scjgj',
    name: '上海市市场监督管理局 - 行政处罚公示',
    url: 'scjgj.sh.gov.cn',
    maintainers: ['AI-Assistant'],
    handler,
    example: '/gov/sh/scjgj',
    parameters: {},
    description: '上海市市场监督管理局行政处罚决定书公示信息',
    categories: ['government'],

    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['scjgj.sh.gov.cn/1073/index.html'],
            target: '/gov/sh/scjgj',
        },
    ],
};
