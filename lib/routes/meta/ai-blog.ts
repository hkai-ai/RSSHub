import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/ai/blog',
    categories: ['programming'],
    example: '/meta/ai/blog',
    name: 'AI Blog',
    maintainers: ['TonyRL'],
    url: 'ai.meta.com/blog/',
    radar: [
        {
            source: ['ai.meta.com/blog/', 'ai.meta.com'],
        },
    ],
    handler,
};

const MONTH_DATE_RE = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s*\d{4}\b/i;

export function extractMetaServerTokens(scriptText: string): {
    lsd: string;
    spinR: string;
    spinB: string;
    spinT: string;
} {
    let lsd = '';
    let spinR = '0';
    let spinB = 'trunk';
    let spinT = String(Date.now());

    const handleMatch = scriptText.match(/\.handle\((\{[\s\S]*?\})\);/);
    if (handleMatch?.[1]) {
        try {
            const parsed = JSON.parse(handleMatch[1]);
            for (const obj of parsed.define || []) {
                const key = obj[0];
                const value = obj[2];
                if (key === 'LSD' && value?.token) {
                    lsd = value.token;
                } else if (key === 'SiteData' && value) {
                    spinR = String(value.__spin_r || '0');
                    spinB = String(value.__spin_b || 'trunk');
                    spinT = String(value.__spin_t || Date.now());
                }
            }
        } catch {
            // Fall through to regex extraction
        }
    }

    if (!lsd) {
        lsd = scriptText.match(/"LSD",\s*\[\],\s*\{"token"\s*:\s*"([^"]+)"\}/)?.[1] || '';
    }
    if (spinR === '0') {
        spinR = scriptText.match(/"__spin_r"\s*:\s*(\d+)/)?.[1] || '0';
    }
    const regexSpinT = scriptText.match(/"__spin_t"\s*:\s*(\d+)/)?.[1];
    if (regexSpinT) {
        spinT = regexSpinT;
    }

    return { lsd, spinR, spinB, spinT };
}

export function parseMetaAiBlogHtml(html: string): DataItem[] {
    const $ = load(html);
    const byUrl = new Map<string, DataItem>();

    $('a[href*="ai.meta.com/blog/"], a[href^="/blog/"]').each((_, el) => {
        const $a = $(el);
        let href = $a.attr('href')?.trim();
        if (!href) {
            return;
        }
        if (href.startsWith('/')) {
            href = `https://ai.meta.com${href}`;
        }
        if (href === 'https://ai.meta.com/blog/' || href === 'https://ai.meta.com/blog') {
            return;
        }

        const text = $a.text().replace(/\s+/g, ' ').trim();
        let dateStr: string | undefined;
        let cur = $a;
        for (let depth = 0; depth < 4; depth++) {
            cur = cur.parent();
            const parentText = cur.text().replace(/\s+/g, ' ').trim();
            if (parentText.length < 350) {
                const m = parentText.match(MONTH_DATE_RE);
                if (m) {
                    dateStr = m[0];
                    break;
                }
            }
        }

        const pubDate = dateStr ? parseDate(`${dateStr} UTC`) : undefined;
        const isCleanTitle = text.length > 5 && !/^(?:FEATURED|Read|Read More)$/i.test(text);
        const existing = byUrl.get(href);

        if (!existing) {
            byUrl.set(href, {
                title: isCleanTitle ? text : href,
                link: href,
                description: isCleanTitle ? text : '',
                pubDate,
            });
        } else {
            if (isCleanTitle && (existing.title === existing.link || text.length > (existing.title?.length || 0))) {
                existing.title = text;
                existing.description = text;
            }
            if (!existing.pubDate && pubDate) {
                existing.pubDate = pubDate;
            }
        }
    });

    return [...byUrl.values()].filter((item) => item.title !== item.link);
}

async function handler(ctx) {
    const limit = Number.parseInt(ctx.req.query('limit') || 12, 10);
    const link = 'https://ai.meta.com/blog/';

    const res = await ofetch(link, {
        headers: {
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
        },
    });
    const $ = load(res);
    const htmlItems = parseMetaAiBlogHtml(res);

    const script = $('script:contains("DTSGInitialData"):first').text();
    const tokens = extractMetaServerTokens(script);

    let gqlItems: DataItem[] = [];
    if (tokens.lsd) {
        try {
            const data = await ofetch('https://ai.meta.com/api/graphql/', {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'x-asbd-id': '359341',
                    'x-fb-friendly-name': 'MetaAIBlogRecentPostSearchQuery',
                    'x-fb-lsd': tokens.lsd,
                },
                body: new URLSearchParams({
                    av: '0',
                    __user: '0',
                    __a: '1',
                    __req: '1',
                    dpr: '1',
                    __ccg: 'EXCELLENT',
                    __rev: tokens.spinR,
                    lsd: tokens.lsd,
                    __spin_r: tokens.spinR,
                    __spin_b: tokens.spinB,
                    __spin_t: tokens.spinT,
                    fb_api_caller_class: 'RelayModern',
                    fb_api_req_friendly_name: 'MetaAIBlogRecentPostSearchQuery',
                    variables: JSON.stringify({ input: { query: '', from: 0, limit, tags: [], excludeObjectIDs: [] } }),
                    server_timestamps: 'true',
                    doc_id: '9516719638450392',
                }),
                parseResponse: JSON.parse,
            });

            gqlItems = (data?.data?.query || []).map((item) => ({
                title: item.title,
                description: item.description || item.title,
                link: item.href,
                pubDate: item.date ? parseDate(item.date) : undefined,
                category: item.research_area ? [item.research_area] : undefined,
                image: item.image,
            }));
        } catch {
            // Fall back to HTML items
        }
    }

    const byUrl = new Map<string, DataItem>();
    for (const item of [...gqlItems, ...htmlItems]) {
        if (!item.link) {
            continue;
        }
        const existing = byUrl.get(item.link);
        if (!existing) {
            byUrl.set(item.link, item);
        } else if (!existing.pubDate && item.pubDate) {
            existing.pubDate = item.pubDate;
        }
    }

    return {
        title: $('#pageTitle').text() || 'Meta AI Blog',
        description: $('meta[name="description"]').attr('content'),
        image: $('link[rel="icon"]').attr('href'),
        link,
        item: [...byUrl.values()].slice(0, limit),
    };
}
