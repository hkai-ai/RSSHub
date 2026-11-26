import { load } from 'cheerio';
import { raw } from 'hono/html';
import { renderToString } from 'hono/jsx/dom/server';

import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import puppeteer from '@/utils/puppeteer';

const ACS_JOURNAL_ISSNS: Record<string, { issn: string; name: string }> = {
    ancac3: { issn: '1936-0851', name: 'ACS Nano' },
    jacsat: { issn: '0002-7863', name: 'Journal of the American Chemical Society' },
    nalefd: { issn: '1530-6984', name: 'Nano Letters' },
    aamick: { issn: '1944-8244', name: 'ACS Applied Materials & Interfaces' },
    chreay: { issn: '0009-2665', name: 'Chemical Reviews' },
    esthag: { issn: '0013-936X', name: 'Environmental Science & Technology' },
    cmatex: { issn: '0897-4756', name: 'Chemistry of Materials' },
};

interface CrossrefAuthor {
    given?: string;
    family?: string;
    name?: string;
}

interface CrossrefWork {
    title?: string[];
    DOI?: string;
    URL?: string;
    abstract?: string;
    author?: CrossrefAuthor[];
    published?: { 'date-parts'?: number[][] };
    created?: { 'date-parts'?: number[][] };
}

export const parseCrossrefJournalWorks = (works: CrossrefWork[]): DataItem[] => {
    const items: DataItem[] = [];
    for (const work of works) {
        const title = (work.title?.[0] ?? '').replaceAll(/\s+/g, ' ').trim();
        const doi = work.DOI?.trim();
        const link = work.URL?.trim() || (doi ? `https://doi.org/${doi}` : '');
        if (!title || !link) {
            continue;
        }
        const parts = work.published?.['date-parts']?.[0] || work.created?.['date-parts']?.[0];
        const pubDate = parts?.length ? parseDate(`${parts[0]}-${String(parts[1] ?? 1).padStart(2, '0')}-${String(parts[2] ?? 1).padStart(2, '0')}`) : undefined;
        const author = (work.author ?? [])
            .map((a) => a.name?.trim() || [a.given, a.family].filter(Boolean).join(' ').trim())
            .filter(Boolean)
            .join(', ');
        const cleanAbstract = (work.abstract ?? '').replaceAll(/<\/?jats:[^>]+>/gi, '').trim();
        const description = cleanAbstract || (author ? `<p>${author}</p>` : title);

        items.push({
            title,
            link,
            guid: doi || link,
            doi,
            author: author || undefined,
            description,
            ...(pubDate && !Number.isNaN(pubDate.getTime()) ? { pubDate } : {}),
        });
    }
    return items;
};

export const route: Route = {
    path: '/journal/:id',
    radar: [
        {
            source: ['pubs.acs.org/journal/:id', 'pubs.acs.org/'],
        },
    ],
    name: 'Journal Articles',
    categories: ['journal'],
    example: '/acs/journal/ancac3',
    maintainers: ['nczitzk'],
    handler,
};

async function handler(ctx) {
    const id = (ctx.req.param('id') ?? '').toLowerCase();
    const rootUrl = 'https://pubs.acs.org';
    const currentUrl = `${rootUrl}/toc/${id}/0/0`;

    const known = ACS_JOURNAL_ISSNS[id];
    if (known) {
        const res = await ofetch<{ message?: { items?: CrossrefWork[] } }>(`https://api.crossref.org/journals/${known.issn}/works`, {
            query: { rows: 25, sort: 'published', order: 'desc' },
        });
        const items = parseCrossrefJournalWorks(res?.message?.items ?? []);
        if (items.length > 0) {
            return {
                title: known.name,
                link: `${rootUrl}/journal/${id}`,
                item: items,
            };
        }
    }

    let title = '';

    const browser = await puppeteer();
    const items = await cache.tryGet(
        currentUrl,
        async () => {
            const page = await browser.newPage();
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                request.resourceType() === 'document' || request.resourceType() === 'script' ? request.continue() : request.abort();
            });
            await page.goto(currentUrl, {
                waitUntil: 'domcontentloaded',
            });
            await page.waitForSelector('.toc');

            const html = await page.evaluate(() => document.documentElement.innerHTML);
            await page.close();

            const $ = load(html);

            title = $('meta[property="og:title"]').attr('content') ?? '';

            return $('.issue-item')
                .toArray()
                .map((item) => {
                    const $item = $(item);

                    const a = $item.find('.issue-item_title a');
                    const doi = $item.find('input[name="doi"]').attr('value');

                    return {
                        doi,
                        guid: doi,
                        title: a.text(),
                        link: `${rootUrl}${a.attr('href')}`,
                        pubDate: parseDate($item.find('.pub-date-value').text(), 'MMMM D, YYYY'),
                        author: $item
                            .find('.issue-item_loa li')
                            .toArray()
                            .map((el) => $(el).text())
                            .join(', '),
                        description: renderDescription($item.find('.issue-item_img').html(), $item.find('.hlFld-Abstract').html()),
                    };
                });
        },
        config.cache.routeExpire,
        false
    );

    await browser.close();

    return {
        title,
        link: currentUrl,
        item: items,
    };
}

const renderDescription = (image: string | null, description: string | null): string =>
    renderToString(
        <>
            {image ? raw(image) : null}
            {description ? raw(description) : null}
        </>
    );
