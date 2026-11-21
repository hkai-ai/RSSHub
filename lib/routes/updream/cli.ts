import { load } from 'cheerio';

import NotFoundError from '@/errors/types/not-found';
import type { Route } from '@/types';
import { absoluteProductLinks, fetchProductHtml } from '@/utils/product-updates';

const link = 'https://www.bilibili.com/aka/cli/';
export const parseCliRelease = (html: string) => {
    const $ = load(html);
    const download = $('a[href*="boss.hdslb.com/updream/cli/"]')
        .toArray()
        .map((element) => $(element).attr('href')!)
        .find((href) => /\/cli\/[^/]+\/updream-/.test(href));
    const version = download?.match(/\/cli\/([^/]+)\//)?.[1];
    if (!version) {
        throw new NotFoundError('The official Updream CLI guide did not expose a release version.');
    }
    const main = $('main').length ? $('main').first().clone() : $('body').clone();
    main.find('script,style,nav,header,footer').remove();
    return [{ title: `Updream CLI ${version}`, link, guid: `updream-cli:${version}`, description: absoluteProductLinks($, main.html() ?? '', link) }];
};
export const route: Route = {
    path: '/cli',
    name: 'CLI发布与能力指南',
    categories: ['program-update'],
    example: '/updream/cli',
    maintainers: ['hkai-ai'],
    description: 'Tracks the version exposed by the official CLI guide. Covers CLI capabilities only, not all Updream releases or its Bilibili operator timeline. No publication time is invented when the guide does not provide one.',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'Updream CLI 发布与能力指南', link, item: parseCliRelease(await fetchProductHtml(link)) }),
};
