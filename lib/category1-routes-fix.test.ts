import { describe, expect, it } from 'vitest';

import { parseAdobeBlogItems } from './routes/adobe/blog';
import { parseEngineering } from './routes/anthropic/engineering';
import { parseAppRouterArticles } from './routes/deeplearning/the-batch';
import { parseGasgooArticles } from './routes/gasgoo/information';
import { parseInsights } from './routes/lexisnexis/insights';
import { parsePressroom } from './routes/lexisnexis/pressroom';
import { parseAnnouncements } from './routes/openrouter/announcements';
import { parsePosts as parseSunoPosts } from './routes/suno/blog';
import { parseWeeklyUpdate } from './routes/troweprice/global-markets-weekly-update';
import { parsePosts as parseZyphraPosts } from './routes/zyphra/blog';

describe('Category 1 fixed RSSHub route parsers', () => {
    it('parses Anthropic Engineering articles via shared list parser', () => {
        const html = `
            <main>
                <article>
                    <a href="/research/building-strong-safety-evaluations">
                        <time>Nov 13, 2026</time>
                        <h3>Building strong safety evaluations</h3>
                        <p>Engineering safety evals.</p>
                    </a>
                </article>
            </main>
        `;
        const items = parseEngineering(html);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Building strong safety evaluations');
        expect(items[0].link).toBe('https://www.anthropic.com/research/building-strong-safety-evaluations');
        expect(new Date(items[0].pubDate!).toISOString()).toBe('2026-11-13T00:00:00.000Z');
    });

    it('filters Adobe query-index array tags and sorts newest first', () => {
        const items = parseAdobeBlogItems(
            [
                {
                    title: 'Older Firefly Post',
                    path: '/en/publish/2025/05/01/older',
                    date: 45778,
                    tags: ['Firefly', 'News'],
                },
                {
                    title: 'Newer Adobe Firefly Post',
                    path: '/en/publish/2025/12/16/newer',
                    date: 46007,
                    tags: ['Adobe Firefly', 'Creative Cloud'],
                },
                {
                    title: 'Unrelated Post',
                    path: '/en/publish/2026/01/01/other',
                    date: 46023,
                    tags: ['Acrobat'],
                },
            ],
            'adobe-firefly'
        );
        expect(items.map((i) => i.title)).toEqual(['Newer Adobe Firefly Post', 'Older Firefly Post']);
        expect(items[0].pubDate?.toISOString().slice(0, 10)).toBe('2025-12-16');
    });

    it('parses DeepLearning.AI The Batch App Router SSR cards', () => {
        const html = `
            <article>
                <a href="/the-batch/tag/data-points">Data Points</a>
                <a href="/the-batch/gpt-6-2-astra"><h3>GPT-6.2 Astra</h3></a>
                <p>Summary of the week.</p>
                <span>November 18, 2026</span>
                <img src="/_next/image?url=https%3A%2F%2Fexample.com%2Fimg.jpg&w=640" alt="cover" />
            </article>
        `;
        const items = parseAppRouterArticles(html, 'https://www.deeplearning.ai', 'en');
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('GPT-6.2 Astra');
        expect(items[0].image).toBe('https://example.com/img.jpg');
        expect(new Date(items[0].pubDate).toISOString().slice(0, 10)).toBe('2026-11-18');
    });

    it('parses Gasgoo SSR category list without Puppeteer', () => {
        const html = `
            <article class="information-list-item">
                <a href="/zh/information/articles/2124787737886195712" class="item-title">新一代理想L7预计2027年正式上市</a>
                <a href="/zh/information/articles/2124787737886195712" class="item-content">盖世汽车讯正文内容</a>
                <footer>
                    <time datetime="2026-11-23T18:31:57.4050000+08:00">2026/11/23</time>
                    <div class="information-list-tags"><a>新车</a><a>理想</a></div>
                </footer>
            </article>
        `;
        const items = parseGasgooArticles(html, '重大事件');
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://autodata.gasgoo.com/zh/information/articles/2124787737886195712');
        expect(items[0].category).toEqual(['重大事件', '新车', '理想']);
    });

    it('parses OpenRouter /blog/announcements/ cards', () => {
        const html = `
            <a href="/blog/announcements/">Announcements</a>
            <a href="/blog/announcements/data-processing/">
                <h3>Data Processing Incidents</h3>
                <p>Summary text</p>
                <time>November 22, 2026</time>
            </a>
        `;
        const items = parseAnnouncements(html);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://openrouter.ai/blog/announcements/data-processing/');
        expect(new Date(items[0].pubDate!).toISOString().slice(0, 10)).toBe('2026-11-22');
    });

    it('parses Suno category SSR cards', () => {
        const html = `
            <div>
                <div class="card">
                    <a href="/blog/category/product-updates">Product updates</a>
                    <a href="/blog/introducing-visuals"><h3>Introducing Visuals</h3></a>
                    <p>Turn songs into clips.</p>
                    <span>By Jack Brody · Nov 17, 2026</span>
                </div>
            </div>
        `;
        const items = parseSunoPosts(html);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Introducing Visuals');
        expect(items[0].author).toBe('Jack Brody');
        expect(new Date(items[0].pubDate!).toISOString().slice(0, 10)).toBe('2026-11-17');
    });

    it('parses Zyphra /our-work cards', () => {
        const html = `
            <a class="card pi-card" href="/our-work/zonos3-mini?from=%2F">
                <h3>ZONOS3-Mini</h3>
                <p>Compact voice-cloning TTS.</p>
                <span class="tag">[Models]</span>
                <span>November 9, 2026</span>
            </a>
        `;
        const items = parseZyphraPosts(html);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://www.zyphra.com/our-work/zonos3-mini');
        expect(items[0].category).toEqual(['Models']);
        expect(new Date(items[0].pubDate!).toISOString().slice(0, 10)).toBe('2026-11-09');
    });

    it('parses T. Rowe Price weekly update JSON-LD datePublished', () => {
        const html = `
            <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"Article","headline":"Global Markets Weekly Update","datePublished":"2026-11-20"}
            </script>
            <h1>Global Markets Weekly Update</h1>
            <h2>U.S.</h2>
        `;
        const feed = parseWeeklyUpdate(html);
        expect(feed.item).toHaveLength(1);
        expect(feed.item[0].link).toContain('?date=2026-11-20');
        expect(feed.item[0].title).toBe('Global Markets Weekly Update (2026-11-20)');
    });

    it('parses LexisNexis Next.js Insights and Pressroom cards', () => {
        const insightsHtml = `
            <a href="/blog/en-us/legal/practical-guidance/october-2026">
                <h3>What's New in Practical Guidance: October 2026</h3>
                <time>November 20, 2026</time>
            </a>
        `;
        const ins = parseInsights(insightsHtml);
        expect(ins).toHaveLength(1);
        expect(new Date(ins[0].pubDate!).toISOString().slice(0, 10)).toBe('2026-11-20');

        const pressHtml = `
            <a href="/news/en/legal-ai-update-announced-today">
                <p>Press Release</p>
                <h3>LexisNexis Announces Next-Generation Legal AI Capabilities</h3>
                <time>November 23, 2026</time>
            </a>
        `;
        const pr = parsePressroom(pressHtml);
        expect(pr).toHaveLength(1);
        expect(pr[0].category).toEqual(['Press Release']);
        expect(new Date(pr[0].pubDate!).toISOString().slice(0, 10)).toBe('2026-11-23');
    });
});
