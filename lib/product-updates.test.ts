import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseTutorials } from './routes/anishort/academy';
import { parseLatestApp } from './routes/apple/apps-latest';
import { parseChangelog as parseDumate } from './routes/baidu/dumate-changelog';
import { parseChangelog as parseMiaoda } from './routes/baidu/miaoda-changelog';
import { parseChangelog as parseCodeBuddy } from './routes/codebuddy/changelog';
import { parseChangelog as parseCodeFlicker } from './routes/codeflicker/changelog';
import { parseChangelog as parseFlova } from './routes/flova/changelog';
import { parseUpdates as parseHuawei } from './routes/huaweicloud/codeartsagent';
import { parseBlog as parseMuse } from './routes/muse/blog';
import { parseBlog as parseRunningHub } from './routes/runninghub/blog';
import { parseNews as parseSenseTime } from './routes/sensetime/news';
import { parseBlog as parseSkywork } from './routes/skywork/blog';
import { parseChanges, renderChangeNode } from './routes/skywork/changelog';
import { parseCliRelease } from './routes/updream/cli';
import { parseCommunity } from './routes/wps/ai';
import { parseProfile, parsePublicWorks } from './routes/xinpianchang/user';
import { parseChangelog as parseZCode } from './routes/zcode/changelog';
import type { DataItem } from './types';
import { parseHelpArticle, parseHelpLinks } from './utils/help-center-updates';

const fixture = (name: string) => readFileSync(new URL(`../tests/product-updates/fixtures/${name}`, import.meta.url), 'utf8');
const cases: Array<[string, (html: string) => DataItem[], string, number]> = [
    ['Muse', parseMuse, '2472.html', 2],
    ['RunningHub', parseRunningHub, '2496.html', 2],
    ['WPS AI community', parseCommunity, '2495.html', 1],
    ['SenseTime', parseSenseTime, '2497.html', 2],
    ['Miaoda', parseMiaoda, '2517.html', 2],
    ['DuMate', parseDumate, '2519.html', 2],
    ['CodeBuddy', parseCodeBuddy, '2518.html', 2],
    ['ZCode', parseZCode, '2523.html', 1],
    ['Flova', parseFlova, '2527.html', 2],
    ['Skywork', parseSkywork, '2520.html', 2],
    ['Huawei CodeArts', parseHuawei, '2525.html', 1],
    ['Xinpianchang profile', parseProfile, '2528.html', 1],
    ['CodeFlicker', parseCodeFlicker, 'codeflicker.html', 2],
];

describe('Product source adapters', () => {
    it.each(cases)('%s preserves entries, bodies and stable identities', (_, parse, name, count) => {
        const items = parse(fixture(name));
        expect(items).toHaveLength(count);
        expect(new Set(items.map((item) => item.guid ?? item.link)).size).toBe(count);
        for (const item of items) {
            expect(item.title).toBeTruthy();
            expect(item.link).toMatch(/^https:\/\//);
            expect(item.description).toBeTruthy();
            if (item.pubDate) {
                expect(Number.isNaN(new Date(item.pubDate).getTime())).toBe(false);
            }
        }
    });

    it.each(cases)('%s rejects an empty or login page instead of emitting a fake update', (_, parse) => {
        expect(() => parse('<html><h1>Sign in</h1><form>Authentication required</form></html>')).toThrow();
    });

    it('keeps each release body with its own version heading', () => {
        const items = parseCodeBuddy(fixture('2518.html'));
        expect(items[0].title).toContain('4.12.4');
        expect(items[0].description).not.toContain('4.12.3');
        expect(items[0].description).not.toContain('header-anchor');
        expect(items[0].link).toContain('#_4-12-4-2026-11-06');
    });

    it('excludes private works from the public profile stream', () => {
        const items = parseProfile(fixture('2528.html'));
        expect(items[0].link).toBe('https://www.xinpianchang.com/a13869391');
        expect(items[0].guid).toBe('xinpianchang:13869391');
    });

    it('uses the official public-works API and rejects unsuccessful responses', () => {
        const data = JSON.parse(fixture('2528.html').match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);
        const response = { status: 0, data: data.props.pageProps.articleData };
        expect(parsePublicWorks(response)).toEqual(parseProfile(fixture('2528.html')));
        expect(() => parsePublicWorks({ status: 401 })).toThrow();
        expect(() => parsePublicWorks({ status: 0, data: { list: [] } })).toThrow();
    });
});

describe('Skywork first-party changelog', () => {
    it('uses official page IDs, source dates and rich text instead of blog SEO posts', () => {
        const items = parseChanges({
            code: 0,
            data: {
                page_list: [
                    {
                        page_info: {
                            page_id: 'release-example',
                            title: 'Example product release',
                            create_time: '2026-07-17 07:27:12',
                            content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Release body' }] }] }),
                        },
                    },
                ],
            },
        });
        expect(items[0].guid).toBe('skywork-changelog:release-example');
        expect(items[0].description).toBe('<p>Release body</p>');
        expect(items[0].pubDate).toBeTruthy();
        expect(items[0].author).toBe('Skywork');
    });

    it('rejects inaccessible or empty changelogs', () => {
        expect(() => parseChanges({ code: 401 })).toThrow();
        expect(() => parseChanges({ code: 0, data: { page_list: [] } })).toThrow();
    });

    it('escapes rich text and drops unsafe links and image sources', () => {
        expect(renderChangeNode({ type: 'text', text: '<script>example</script>', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] })).toBe('&lt;script&gt;example&lt;/script&gt;');
        expect(renderChangeNode({ type: 'image', attrs: { src: 'javascript:alert(1)' } })).toBe('');
        expect(renderChangeNode({ type: 'image', attrs: { src: '/fallback.png', cdnsrc: 'https://skyworkcdn-wiki.skyworkcdn.com/example.png' } })).toContain('https://skyworkcdn-wiki.skyworkcdn.com/example.png');
    });
});

describe('Latest App Store release snapshots', () => {
    const apps = JSON.parse(fixture('apps.json')) as Array<Parameters<typeof parseLatestApp>[0]>;

    it.each(apps)('$trackName keeps the official version and source timestamp', (app) => {
        const item = parseLatestApp(app, 'cn');
        expect(item.title).toContain(app.version);
        expect(item.guid).toBe(`apple-latest:cn:${app.trackId}:${app.version}`);
        expect(new Date(item.pubDate!).getTime()).toBe(new Date(app.currentVersionReleaseDate!).getTime());
        expect(item.link).toBe(app.trackViewUrl);
    });

    it('escapes release notes and never substitutes the current date', () => {
        const item = parseLatestApp({ ...apps[0], currentVersionReleaseDate: undefined, releaseNotes: '<script>example</script>\nsecond line' }, 'cn');
        expect(item.pubDate).toBeUndefined();
        expect(item.description).toContain('&lt;script&gt;');
        expect(item.description).toContain('<br>');
    });
});

describe('Official feature documentation alternatives', () => {
    const leonardo = 'https://intercom.help/leonardo-ai/en/collections/5295455-feature-releases';
    const meshy = 'https://help.meshy.ai/en/collections/10642994-features';

    it('ignores navigation and off-origin injected links', () => {
        expect(parseHelpLinks(fixture('collection-leo.html'), leonardo)).toEqual(['https://intercom.help/leonardo-ai/en/articles/12760267-blueprints-by-leonardo-ai']);
        expect(parseHelpLinks(fixture('collection-meshy.html'), meshy)).toEqual(['https://help.meshy.ai/en/articles/15297780-getting-started-with-meshy-agent']);
    });

    it.each(['leo-article.html', 'meshy-article.html'])('uses the stated document update time in %s', (name) => {
        const item = parseHelpArticle(fixture(name), 'https://help.meshy.ai/en/articles/example');
        expect(item.updated).toEqual(item.pubDate);
        expect(item.guid).toContain(':updated:2026-');
        expect(item.description).not.toContain('<h1');
        expect(item.description).not.toContain('<time');
    });
});

describe('Official AniShort and Updream streams', () => {
    it('does not confuse an AniShort user work with official tutorial ID 172', () => {
        const items = parseTutorials(JSON.parse(fixture('anishort.json')));
        expect(items).toHaveLength(1);
        expect(items[0].guid).toBe('anishort-tutorial:172');
        expect(items[0].enclosure_type).toBe('video/mp4');
        expect(new Date(items[0].pubDate!).toISOString()).toBe('2026-11-21T00:26:46.000Z');
    });

    it('reports failed tutorial responses as failures', () => {
        expect(() => parseTutorials({ code: 401, data: { list: [] } })).toThrow();
    });

    it('keeps the Updream CLI scope and leaves an unavailable date blank', () => {
        const items = parseCliRelease(fixture('updream-cli.html'));
        expect(items[0].title).toBe('Updream CLI 0.0.0-beta');
        expect(items[0].guid).toBe('updream-cli:0.0.0-beta');
        expect(items[0].pubDate).toBeUndefined();
        expect(() => parseCliRelease('<h1>Sign in</h1>')).toThrow();
    });
});
