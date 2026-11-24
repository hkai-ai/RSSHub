import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { DataItem } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import ofetch from '@/utils/ofetch';

import { parseArticleList } from './routes/anthropic/list';
import { parseResearch } from './routes/anthropic/research';
import { parsePosts as bolt } from './routes/bolt/blog';
import { parsePosts as dify } from './routes/dify/blog';
import { parsePosts as ii } from './routes/ii/blog';
import { parsePosts as liquid } from './routes/liquid/blog';
import { parseArticles as perplexity } from './routes/perplexity/articles';
import { handler as perplexityBlog } from './routes/perplexity/blog';
import { handler as perplexityResearch } from './routes/perplexity/research';
import { handler as seedHandler, parsePosts as seed } from './routes/seed/blog';
import { handler as tripoHandler, parsePosts as tripo } from './routes/tripo3d/blog';
import { parsePosts as xai } from './routes/xai/news';

vi.mock('@/utils/ofetch', () => ({ default: vi.fn() }));
vi.mock('@/utils/bright-data-unlocker', () => ({ unlockWebsite: vi.fn() }));

// Extracts from the public websites retrieved on 2026-11-16.
const fixture = (name: string) => readFileSync(new URL(`../tests/account-route/fixtures/${name}`, import.meta.url), 'utf8');
const date = (item: DataItem) => new Date(item.pubDate!).toISOString();

describe('Official account routes after website redesigns', () => {
    it('pairs Anthropic dates with their own sibling heading and supports root-level launch URLs', () => {
        const items = parseArticleList(fixture('anthropic_news.html'), 'news');
        const launch = items.find((item) => item.link === 'https://www.anthropic.com/claude-fable-and-mythos-5-2')!;
        expect(launch.title).toBe('Introducing Claude Fable 5.2 and Claude Mythos 5.2');
        expect(date(launch)).toBe('2026-11-09T00:00:00.000Z');
        expect(launch.category).toEqual(['Announcements']);
        expect(items.length).toBeGreaterThan(2);
    });

    it('handles research carousel headings outside the time anchor', () => {
        const items = parseResearch(fixture('anthropic_research.html'));
        const vault = items.find((item) => item.link?.endsWith('/investigating-vault-particles-with-claude'))!;
        expect(date(vault)).toBe('2026-11-04T00:00:00.000Z');
        expect(vault.title).toBe('Investigating vault particles with Claude');
        expect(items).toHaveLength(4);
    });

    it('does not reuse a neighboring Anthropic article date for an undated card', () => {
        const html =
            '<main><section><article><time>Nov 1, 2026</time><p>No article link</p></article><article><a href="/news/undated"><h2>Undated</h2></a></article><article><time>Nov 2, 2026</time><a href="/news/dated"><h2>Dated</h2></a></article></section></main>';
        expect(parseArticleList(html, 'news').map((item) => item.title)).toEqual(['Dated']);
        expect(() => parseArticleList(html.replace('<article><time>Nov 2, 2026</time><a href="/news/dated"><h2>Dated</h2></a></article>', ''), 'news')).toThrow('No Anthropic news articles');
    });

    it('reads Astro Dify cards with exact timestamps and author', () => {
        const items = dify(fixture('dify.html'));
        expect(items).toHaveLength(3);
        expect(items[0].author).toBe('Anne Zhu');
        expect(date(items[0])).toBe('2026-11-05T12:00:00.000Z');
        expect(items[0].category).toEqual(['Company']);
    });

    it('includes Bolt featured and regular cards without detail-page requests', () => {
        const items = bolt(fixture('bolt.html'));
        expect(items).toHaveLength(3);
        expect(items.some((item) => item.title === 'MVP development in 2026: How to pick your build path')).toBe(true);
        expect(date(items[0])).toBe('2026-11-12T00:00:00.000Z');
    });

    it('includes Perplexity featured dates alongside research table dates', () => {
        const items = perplexity(fixture('perplexity_research.html'));
        expect(items).toHaveLength(4);
        expect(items[0].title).toBe('Introducing Perplexity Frontier Research');
        expect(date(items[0])).toBe('2026-11-16T00:00:00.000Z');
        expect(date(items[1])).toBe('2026-11-12T00:00:00.000Z');
    });

    it('requests the current Perplexity blog and research category independently', async () => {
        vi.mocked(ofetch).mockResolvedValueOnce(fixture('perplexity_blog.html')).mockResolvedValueOnce(fixture('perplexity_research.html'));
        const blog = await perplexityBlog();
        const research = await perplexityResearch();
        expect(blog.item.some((item) => item.title === 'Teammates are agents for complex, ongoing work')).toBe(true);
        expect(research.item.some((item) => item.title === 'Perplexity Decider')).toBe(true);
        expect(ofetch).toHaveBeenCalledWith('https://www.perplexity.ai/hub/blog', { retry: 0 });
        expect(ofetch).toHaveBeenCalledWith('https://www.perplexity.ai/hub/blog/category/research', { retry: 0 });
    });

    it('uses the configured unlocker when the server network is blocked', async () => {
        vi.mocked(ofetch).mockRejectedValueOnce(new Error('403 Forbidden'));
        vi.mocked(unlockWebsite).mockResolvedValueOnce(fixture('perplexity_research.html'));
        const result = await perplexityResearch();
        expect(result.item).toHaveLength(4);
        expect(unlockWebsite).toHaveBeenCalledWith('https://www.perplexity.ai/hub/blog/category/research');
    });

    it('fetches Seed blogs from the public API and uses the official shared slug', async () => {
        const data = JSON.parse(fixture('seed.json'));
        vi.mocked(ofetch).mockResolvedValueOnce(data);
        const result = await seedHandler();
        expect(ofetch).toHaveBeenCalledWith('https://seed.bytedance.com/api/get_article_list_v2', { query: { article_type: 2, count: 20, page_token: 0, order_desc: true } });
        expect(result.item).toHaveLength(2);
        expect(result.item[1].link).toBe('https://seed.bytedance.com/zh/blog/more-realistic-images-more-stable-editing-across-100-rounds-introducing-seedream-5-5');
        expect(date(result.item[0])).toBe('2026-11-15T16:00:00.000Z');
        const paper = structuredClone(data.sub_article_list[0]);
        paper.ArticleMeta.ArticleType = 1;
        expect(seed({ sub_article_list: [...data.sub_article_list, paper] })).toHaveLength(2);
    });

    it('reads Intelligent Internet posts from current page data', () => {
        const items = ii(fixture('ii.html'));
        expect(items).toHaveLength(2);
        expect(items[0].link).toBe('https://ii.inc/blog/post/evoke');
        expect(date(items[0])).toBe('2026-10-08T12:00:00.000Z');
        expect(items[0].image).toBe('https://ii.inc/images/evoke/og.jpg');
    });

    it('keeps all Liquid news categories and deduplicates the featured row', () => {
        const items = liquid(fixture('liquid_all.html'));
        expect(items).toHaveLength(3);
        expect(items[0].title).toBe('d1.2: State-of-the-Art Omnimodal Decision Models');
        expect(items[1].category).toEqual(['Engineering']);
        expect(date(items[1])).toBe('2026-11-12T00:00:00.000Z');
    });

    it('parses xAI featured, grid and archive row dates', () => {
        const items = xai(fixture('xai.html'));
        expect(items).toHaveLength(11);
        expect(date(items[0])).toBe('2026-11-02T00:00:00.000Z');
        expect(date(items[10])).toBe('2026-09-18T00:00:00.000Z');
        expect(items[0].image).toBe('https://x.ai/images/news/grok-bot-1-0-og-2.png');
    });

    it('retains Tripo category filtering with the confirmed unlocker transport', async () => {
        vi.mocked(unlockWebsite).mockResolvedValueOnce(fixture('tripo.html'));
        const result = await tripoHandler({ req: { param: () => 'creator' } } as Parameters<typeof tripoHandler>[0]);
        expect(result.item).toHaveLength(1);
        expect(result.item[0].category).toEqual(['Creator Notes']);
        expect(date(result.item[0])).toBe('2026-11-13T00:00:00.000Z');
        expect(unlockWebsite).toHaveBeenCalledWith('https://www.tripo3d.ai/blog');
    });

    it('keeps URLs unique when featured content is repeated', () => {
        for (const [parser, name] of [
            [dify, 'dify'],
            [bolt, 'bolt'],
            [perplexity, 'perplexity_blog'],
            [liquid, 'liquid_all'],
            [xai, 'xai'],
            [tripo, 'tripo'],
        ] as const) {
            const html = fixture(`${name}.html`);
            const items = parser(html + html);
            expect(new Set(items.map((item) => item.link)).size).toBe(items.length);
        }
    });

    it('fails visibly when an upstream redesign removes the article list', () => {
        for (const parser of [dify, bolt, perplexity, liquid, xai, tripo]) {
            expect(() => parser('<main></main>')).toThrow(/No .* articles/);
        }
    });
});
