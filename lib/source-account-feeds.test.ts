import { describe, expect, it } from 'vitest';

import { parseItem as parseBaaiHubItem } from './routes/baai/utils';
import { parseBflBlogList } from './routes/bfl/blog';
import { parseCerebrasArticleDate, parseCerebrasNewsroom } from './routes/cerebras/pure';
import { parseCursorBlogHtml } from './routes/cursor/blog';
import { findDeepSeekNewsPage, parseDeepSeekNews, parseDeepSeekUpdates } from './routes/deepseek/pure';
import { extractJinaContentKey, mapJinaPosts } from './routes/jina/pure';
import { parseKimiBlog } from './routes/kimi/pure';
import { parseLovableBlogHtml } from './routes/lovable/blog';
import { parseLumaNewsHtml } from './routes/lumalabs/blog';
import { extractMetaServerTokens, parseMetaAiBlogHtml } from './routes/meta/ai-blog';
import { parseMiniMaxBlogHtml } from './routes/minimaxi/models';
import { parsePoolsideArticleDate, parsePoolsideBlog } from './routes/poolside/pure';
import { parsePrimeIntellectBlog } from './routes/primeintellect/pure';
import { parseQwenRetrievalArticles } from './routes/qwen/research';
import { parseReplitNextData } from './routes/replit/blog';
import { parseHunyuanResearchPublicList } from './routes/tencent/hunyuan/blog';

describe('official source account feeds', () => {
    it('discovers the current DeepSeek news path and takes dates from real sidebar labels', () => {
        expect(findDeepSeekNewsPage('<a href="/zh-cn/news/news261113">新闻</a>')).toBe('https://api-docs.deepseek.com/zh-cn/news/news261113');
        const items = parseDeepSeekNews('<aside><a href="/zh-cn/news/news261113">API 发布 2026/11/13</a><a href="/zh-cn/updates">更新日志</a></aside>');
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('API 发布');
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-11-12T16:00:00.000Z');
    });

    it('keeps DeepSeek update sections separate with their real anchors', () => {
        const items = parseDeepSeekUpdates(
            '<div class="theme-doc-markdown"><h2 id="date-2026-11-13">Date: 2026-11-13</h2><h3>New APIs</h3><p>First change</p><h2 id="date-2026-10-17">Date: 2026-10-17</h2><h3>Search API</h3><p>Second change</p></div>'
        );
        expect(items).toHaveLength(2);
        expect(items[0].link).toBe('https://api-docs.deepseek.com/updates#date-2026-11-13');
        expect(items[0].description).toContain('First change');
        expect(items[0].description).not.toContain('Second change');
    });
    it('keeps Cerebras first-party posts and excludes linked media coverage', () => {
        const items = parseCerebrasNewsroom(
            '<main><a href="/blog/release"><h3>Official release</h3></a><a href="https://www.reuters.com/news/example"><h3>Media story</h3></a><a href="/blog/release"><h3>Official release</h3></a></main>'
        );
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://www.cerebras.ai/blog/release');
    });

    it('does not replace missing publication dates with modification time', () => {
        expect(parseCerebrasArticleDate('<meta property="article:modified_time" content="2026-11-16T00:00:00Z">')).toBeUndefined();
        expect(parseCerebrasArticleDate('<main><p>Nov 10 2026</p><h1>Release</h1></main>')?.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    });

    it('reads the public Jina content key without hardcoding a deployment hash', () => {
        expect(extractJinaContentKey('new URLSearchParams({key:"abcdef123456",limit:"30"})')).toBe('abcdef123456');
        expect(extractJinaContentKey('const noNewsConfig = true')).toBeUndefined();
    });

    it('maps Jina CMS posts to public news links and actual timestamps', () => {
        const items = mapJinaPosts([{ title: 'New model', slug: 'new-model', published_at: '2026-11-10T12:00:00+02:00', authors: [{ name: 'Jina AI' }] }]);
        expect(items[0].link).toBe('https://jina.ai/news/new-model/');
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-11-10T10:00:00.000Z');
        expect(mapJinaPosts([{ title: 'Bad link', slug: '../outside' }])).toEqual([]);
    });

    it('deduplicates Kimi featured cards and excludes navigation links', () => {
        const card = '<div class="menu-card"><a href="/en/blog/kimi-release" aria-label="Kimi release"></a><h4 class="card-title">Kimi release</h4><p class="card-date">2026-10-24</p></div>';
        const items = parseKimiBlog(`<nav><a href="/en/blog/navigation">Ignore</a></nav><main>${card}${card}</main>`);
        expect(items).toHaveLength(1);
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-10-24T00:00:00.000Z');
    });

    it('retains the dated Poolside row when the featured card repeats it', () => {
        const items = parsePoolsideBlog('<main><a href="/blog/release"><article><h3>Release</h3><time datetime="2026-07-28"></time></article></a><a href="/blog/release"><article><h3>Release</h3></article></a></main>');
        expect(items).toHaveLength(1);
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-07-28T00:00:00.000Z');
        expect(parsePoolsideArticleDate('<time datetime="not-a-date"></time>')).toBeUndefined();
    });

    it('separates Prime Intellect card dates from category labels', () => {
        const items = parsePrimeIntellectBlog('<main><a href="/blog/release"><span class="rf-strip-title">Release</span><span class="rf-strip-date">NOV 3, 2026<i>/</i>Research</span></a></main>');
        expect(items).toHaveLength(1);
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-11-03T00:00:00.000Z');
    });

    it('parses Tencent Hunyuan research publicList items with clean markdown and research URLs', () => {
        const items = parseHunyuanResearchPublicList([
            {
                id: 100145,
                title: 'Introducing Hy4 flash',
                author: 'Hy LLM',
                customUrl: 'hy4-flash',
                displayPublishTime: 1794758400,
                content: '@@@coverCard\ntype = "image"\n@@@\n\nHy4 flash body content',
            },
        ]);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://hy.tencent.com/research/hy4-flash');
        expect(items[0].description).toBe('Hy4 flash body content');
    });

    it('parses MiniMax blog cards into canonical article URLs with timestamps', () => {
        const html = `
          <a href="/blog/minimax-m31f"><span>MiniMax M3.1 Flash</span><span>NEW</span></a>
          <a href="/blog/minimax-m31f"><article><h2>MiniMax M3.1 Flash: Redefining Agent Performance</h2><footer><time datetime="2026-10-19T00:00:00.000Z">2026-10-19</time></footer></article></a>
        `;
        const items = parseMiniMaxBlogHtml(html);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://www.minimax.io/blog/minimax-m31f');
        expect(items[0].title).toBe('MiniMax M3.1 Flash: Redefining Agent Performance');
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    });

    it('parses Qwen v2 retrieval articles sorted by extra.date descending', () => {
        const items = parseQwenRetrievalArticles([
            {
                id: 'uuid-1',
                path: 'sapo',
                title: 'SAPO',
                extra: { date: '2025-12-05T04:00:00+08:00', introduction: 'Older post' },
            },
            {
                id: 'uuid-2',
                path: 'qwen4-max',
                title: 'Qwen4-Max：新同事，已就位',
                extra: { date: '2026-11-16T10:00:00+08:00', introduction: 'Latest post' },
            },
        ]);
        expect(items).toHaveLength(2);
        expect(items[0].link).toBe('https://qwen.ai/blog?id=qwen4-max&from=research.latest-advancements-list');
        expect(items[0].title).toBe('Qwen4-Max：新同事，已就位');
    });

    it('parses BFL blog cards when <article> is nested inside <a href="/blog/...">', () => {
        const html = `
          <div class="grid">
            <a href="/blog/flux-3-image-klein">
              <article>
                <span>Models</span>
                <h2>FLUX 3 Image Klein</h2>
                <p>A 5.6B parameter open weights model.</p>
                <span>October 15, 2026</span>
              </article>
            </a>
            <a href="/blog/flux-3-action">
              <article>
                <h2>Introducing FLUX 3 Action</h2>
                <span>September 23, 2026</span>
              </article>
            </a>
          </div>
        `;
        const items = parseBflBlogList(html);
        expect(items).toHaveLength(2);
        expect(items[0].link).toBe('https://bfl.ai/blog/flux-3-image-klein');
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-10-15T00:00:00.000Z');
        expect((items[1].pubDate as Date).toISOString()).toBe('2026-09-23T00:00:00.000Z');
    });

    it('extracts Meta AI ServerJS tokens from s.handle({...}) and parses HTML blog cards', () => {
        const script = 'var s=(new ServerJS());s.handle({"define":[["LSD",[],{"token":"lsd_abc"},323],["SiteData",[],{"__spin_r":105582,"__spin_b":"trunk","__spin_t":1795404011},317]]});';
        const tokens = extractMetaServerTokens(script);
        expect(tokens.lsd).toBe('lsd_abc');
        expect(tokens.spinR).toBe('105582');

        const html = '<div><a href="https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/">FEATURED</a><div><a href="https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/">Introducing Muse Spark 1.1</a><span>July 9, 2026</span></div></div>';
        const items = parseMetaAiBlogHtml(html);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Introducing Muse Spark 1.1');
        expect((items[0].pubDate as Date).toISOString()).toBe('2026-07-09T00:00:00.000Z');
    });

    it('sorts Cursor blog posts by date descending so old featured cards do not crowd out recent posts', () => {
        const html = `
          <main id="main">
            <article><a href="/blog/joining-spacex"><p>Cursor joins SpaceX</p><time datetime="2026-08-14T12:00:00.000Z"></time></a></article>
            <a href="/blog/security-incident-update"><article><p>An update on our recent security incident</p><time datetime="2026-11-13T12:00:00.000Z"></time></article></a>
          </main>
        `;
        const items = parseCursorBlogHtml(html, 10);
        expect(items).toHaveLength(2);
        expect(items[0].link).toBe('https://cursor.com/blog/security-incident-update');
    });

    it('parses Replit __NEXT_DATA__ safely when featuredPost is absent and uses replit.com/blog links', () => {
        const items = parseReplitNextData({
            props: {
                pageProps: {
                    data: {
                        posts: [
                            {
                                title: 'Securely connect Replit to your private network with Tunnels',
                                slug: 'build-with-private-data-using-tunnels',
                                summary: 'Connect private data.',
                                publishedAt: '2026-11-20T17:55:00.000Z',
                            },
                        ],
                    },
                },
            },
        });
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://replit.com/blog/build-with-private-data-using-tunnels');
    });

    it('parses Lovable blog cards, BAAI Hub story items, and Luma News cards', () => {
        const lovable = parseLovableBlogHtml('<a href="/blog/lovable-app-studio-atlanta"><h2>Lovable App Studio</h2><p>Opening soon</p><time datetime="2026-11-20T11:00:00.000Z"></time></a>');
        expect(lovable).toHaveLength(1);
        expect(lovable[0].link).toBe('https://lovable.dev/blog/lovable-app-studio-atlanta');

        const baai = parseBaaiHubItem({
            is_event: false,
            story_id: 59943,
            story_info: {
                id: 59943,
                title: 'NUS发布System One模型评测基准',
                created_at: '2026-11-23 08:50 分享',
                content: '智源社区摘要正文',
                user_name: '智源社区',
                tag_names: [{ title: '评测' }],
            },
        });
        expect(baai.link).toBe('https://hub.baai.ac.cn/view/59943');
        expect(baai.description).toBe('智源社区摘要正文');

        const luma = parseLumaNewsHtml('<div class="group"><span>Guides</span><span>Nov 22, 2026</span><a class="card-link" href="/news/ai-christmas-ads">AI Christmas Ads</a></div>');
        expect(luma).toHaveLength(1);
        expect(luma[0].link).toBe('https://lumalabs.ai/news/ai-christmas-ads');
        expect(luma[0].category).toEqual(['Guides']);
    });
});
