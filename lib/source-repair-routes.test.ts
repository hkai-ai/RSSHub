import { describe, expect, it } from 'vitest';

import { parseCrossrefJournalWorks } from './routes/acs/journal';
import { parseLawTechnologyToday } from './routes/americanbar/law-technology-today';
import { parseBibiGptBlog } from './routes/bibigpt/blog';
import { parseBioItWorldNews } from './routes/bio-itworld/news';
import { parseCerebrasBlog } from './routes/cerebras/pure';
import { parseDigitalingArticles } from './routes/digitaling/articles';
import { parseHi3dBlog } from './routes/hi3d/blog';
import { parseLegalMosaicArticles } from './routes/legalmosaic/articles';
import { parseLmsysBlog } from './routes/lmsys/blog';
import { parseNavitasNewsRss } from './routes/navitassemi/news';
import { parseNeotaLogicBlog } from './routes/neotalogic/blog';
import { parseNovosnsArticle, parseNovosnsSitemap } from './routes/novosns/news';
import { parsePubMedSummaries } from './routes/pubmed/search';
import { parseTiNewsRss } from './routes/ti/news';
import { parseUntcNews } from './routes/unt-c/news';
import { parseWoltersKluwerListing } from './routes/wolterskluwer/pure';
import { parseZmjsemiNews } from './routes/zmjsemi/news';

describe('Online source repair RSSHub routes', () => {
    it('parses Cerebras blog cards and deduplicates repeated links', () => {
        const html = `
            <main>
                <a href="/blog/cerebras-launches-disaggregated-inference">Cerebras launches disaggregated inference &gt;&gt;</a>
                <a href="/blog/cerebras-launches-disaggregated-inference">
                    <h3>Cerebras launches disaggregated inference</h3>
                    <span>November 17, 2026</span>
                </a>
                <a href="/blog/what-it-took-to-build-wafer-scale">
                    <span>November 05, 2026</span>
                    <h2>What It Took to Build Wafer-Scale</h2>
                    <span>Read blog post</span>
                </a>
            </main>
        `;
        const items = parseCerebrasBlog(html);
        expect(items).toHaveLength(2);
        expect(items[0].title).toBe('Cerebras launches disaggregated inference');
        expect(items[0].link).toBe('https://www.cerebras.ai/blog/cerebras-launches-disaggregated-inference');
        expect(new Date(items[0].pubDate!).toISOString()).toBe('2026-11-17T00:00:00.000Z');
        expect(items[1].title).toBe('What It Took to Build Wafer-Scale');
    });

    it('parses Digitaling articles list and skips duplicate or numeric links', () => {
        const html = `
            <ul class="clearfix">
                <li>
                    <div class="con">
                        <h3><a href="https://www.digitaling.com/articles/1630355.html">品牌故事还管用吗？</a></h3>
                        <p>换个角度理解过日子。</p>
                    </div>
                </li>
                <li>
                    <div class="con">
                        <h3><a href="https://www.digitaling.com/articles/1630355.html">品牌故事还管用吗？</a></h3>
                        <p>重复条目</p>
                    </div>
                </li>
            </ul>
        `;
        const items = parseDigitalingArticles(html);
        expect(items).toHaveLength(1);
        expect(items[0]).toEqual({
            title: '品牌故事还管用吗？',
            link: 'https://www.digitaling.com/articles/1630355.html',
            description: '换个角度理解过日子。',
        });
    });

    it('parses Hi3D blog links cleanly', () => {
        const html = `
            <div>
                <a href="/blog/hi3dembroidery-user-guide">
                    <h3>Hi3D Embroidery User Guide</h3>
                    <p>Step-by-step tutorial.</p>
                </a>
                <a href="/blog/">Blog</a>
            </div>
        `;
        const items = parseHi3dBlog(html);
        expect(items).toHaveLength(1);
        expect(items[0]).toEqual({
            title: 'Hi3D Embroidery User Guide',
            link: 'https://www.hi3d.ai/blog/hi3dembroidery-user-guide',
            description: 'Step-by-step tutorial.',
        });
    });

    it('filters Chinese Novosns sitemap entries and sorts newest first', () => {
        const xml = `
            <urlset>
                <url><loc>https://www.novosns.com/en/news-details/100</loc><lastmod>2026-11-20T10:00:00+08:00</lastmod></url>
                <url><loc>https://www.novosns.com/news-details/200</loc><lastmod>2026-11-12T11:04:44+08:00</lastmod></url>
                <url><loc>https://www.novosns.com/news-details/300</loc><lastmod>2026-11-17T16:20:38+08:00</lastmod></url>
            </urlset>
        `;
        const entries = parseNovosnsSitemap(xml, 10);
        expect(entries.map((e) => e.link)).toEqual(['https://www.novosns.com/news-details/300', 'https://www.novosns.com/news-details/200']);

        const parsed = parseNovosnsArticle('<html><head><title>纳芯微新品发布 | novosns.com</title></head><body><main><p>正文内容</p></main></body></html>', 'https://www.novosns.com/news-details/300');
        expect(parsed.title).toBe('纳芯微新品发布');
        expect(parsed.description).toContain('正文内容');
    });

    it('parses UNT-C redesigned news cards with dot-formatted dates', () => {
        const html = `
            <a href="/news/148" class="niin-case">
                <img src="/Public/Cn/images/d1_img01un.png" alt="">
                <img src="/Public/Uploads/uploadfile/images/20261027/cover.jpeg" alt="cover">
                <div class="niin-case-ri-date">2026.10.27</div>
                <div class="niin-case-ri-tit">芯联集成与理想签署新一轮战略合作协议</div>
            </a>
        `;
        const items = parseUntcNews(html);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('芯联集成与理想签署新一轮战略合作协议');
        expect(items[0].link).toBe('https://cn.unt-c.com/news/148');
        expect(items[0].description).toContain('https://cn.unt-c.com/Public/Uploads/uploadfile/images/20261027/cover.jpeg');
        expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('parses ZMJ Semi news list with hyphenated dates without detail fan-out', () => {
        const html = `
            <a class="zz-a" href="/news/company_new/41">
                <div class="public-img"><img class="zz-img1" src="/uploads/images/cover.png" alt="cover"></div>
                <h3 class="zz-textb">真茂佳SHV系列3300V SiC MOSFET批量交付！</h3>
                <div class="zz-text">批量交付摘要</div>
                <div class="zz-date"><span class="font20">2025-12-29</span></div>
            </a>
        `;
        const items = parseZmjsemiNews(html);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('真茂佳SHV系列3300V SiC MOSFET批量交付！');
        expect(items[0].link).toBe('https://www.zmjsemi.com/news/company_new/41');
        expect(items[0].description).toContain('批量交付摘要');
        expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('parses official investor RSS feeds for TI and Navitas Semiconductor', () => {
        const rss = `<?xml version="1.0" encoding="utf-8"?>
            <rss version="2.0"><channel>
                <item>
                    <title>New Power Management Chip Launch</title>
                    <link>https://investor.ti.com/news-releases/news-release-details/chip-launch</link>
                    <description>Details about the new power chip.</description>
                    <pubDate>Tue, 24 Nov 2026 13:00:00 +0000</pubDate>
                    <guid>chip-launch-1</guid>
                </item>
            </channel></rss>
        `;
        const tiItems = parseTiNewsRss(rss);
        expect(tiItems).toHaveLength(1);
        expect(tiItems[0].title).toBe('New Power Management Chip Launch');
        expect(tiItems[0].pubDate).toBeInstanceOf(Date);

        const navItems = parseNavitasNewsRss(rss);
        expect(navItems).toHaveLength(1);
        expect(navItems[0].guid).toBe('chip-launch-1');
    });

    it('parses Wolters Kluwer unlocked news and expert insights listings', () => {
        const html = `
            <div>
                <article class="wk-card">
                    <a href="/en/news/wolters-kluwer-launches-blue-chip-iq"><h3>Wolters Kluwer launches Blue Chip IQ</h3></a>
                    <p>AI-powered economic intelligence platform announcement.</p>
                </article>
                <article class="wk-card">
                    <a href="/en/expert-insights/the-safety-shift-of-ehs-readiness-in-2026"><h3>The Safety Shift of EHS Readiness in 2026</h3></a>
                    <p>Detailed analysis on EHS readiness across industries.</p>
                </article>
            </div>
        `;
        const news = parseWoltersKluwerListing(html, '/en/news/');
        expect(news).toHaveLength(1);
        expect(news[0].link).toBe('https://www.wolterskluwer.com/en/news/wolters-kluwer-launches-blue-chip-iq');

        const insights = parseWoltersKluwerListing(html, '/en/expert-insights/');
        expect(insights).toHaveLength(1);
        expect(insights[0].link).toBe('https://www.wolterskluwer.com/en/expert-insights/the-safety-shift-of-ehs-readiness-in-2026');
    });

    it('parses Legal Mosaic Forbes archive cards', () => {
        const html = `
            <article class="article-card">
                <time>15 September 2020</time>
                <h3><a href="/articles/legal-transformation/">Legal Transformation Is A Business Story</a></h3>
                <p>Why legal change belongs within wider business transformation.</p>
            </article>
        `;
        const items = parseLegalMosaicArticles(html);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://www.legalmosaic.com/articles/legal-transformation/');
        expect(items[0].author).toBe('Mark A. Cohen');
        expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('parses LMSYS Next.js RSC blog entries cleanly', () => {
        const html = String.raw`\"slug\":\"2026-11-23-ernie55\",\"title\":\"Toward the Decode Limit \u0026 Fast Serving\",\"author\":\"LMSYS Team\",\"date\":\"November 23, 2026\",\"excerpt\":\"Low latency inference benchmark.\"`;
        const items = parseLmsysBlog(`{${html}}`);
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Toward the Decode Limit & Fast Serving');
        expect(items[0].link).toBe('https://www.lmsys.org/blog/2026-11-23-ernie55/');
        expect(items[0].author).toBe('LMSYS Team');
        expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('parses Neota Logic Webflow blog cards', () => {
        const html = `
            <div class="bl-grid w-dyn-items">
                <div class="w-dyn-item">
                    <a href="/blog/email-workflow-automation-for-legal" class="bl-card">
                        <div class="bl-card-meta"><div>November 24, 2026</div></div>
                        <h2 class="bl-card-title">Email Workflow Automation for Legal Teams</h2>
                        <p class="bl-card-excerpt">Governed AI workflow guide.</p>
                    </a>
                </div>
            </div>
        `;
        const items = parseNeotaLogicBlog(html);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://www.neotalogic.com/blog/email-workflow-automation-for-legal');
        expect(items[0].description).toBe('Governed AI workflow guide.');
        expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('parses BibiGPT blog cards with Chinese publication dates', () => {
        const html = `
            <a href="/zh/blog/posts/bibigpt-newsletter-2026-11-23">
                <h3>BibiGPT v4.833.0 更新：竖着刷要点</h3>
                <p>发布于 2026年11月23日</p>
                <p>处理队列跑完一批，点刷这批就能竖着刷要点。</p>
            </a>
        `;
        const items = parseBibiGptBlog(html);
        expect(items).toHaveLength(1);
        expect(items[0].link).toBe('https://bibigpt.cn/zh/blog/posts/bibigpt-newsletter-2026-11-23');
        expect(items[0].title).toBe('BibiGPT v4.833.0 更新：竖着刷要点');
        expect(items[0].pubDate).toBeInstanceOf(Date);
    });

    it('parses Crossref ACS journal works and PubMed E-utilities summaries', () => {
        const acsItems = parseCrossrefJournalWorks([
            {
                title: ['Side-Chain Engineering in ACS Nano'],
                DOI: '10.1021/acsnano.6c13408',
                URL: 'https://doi.org/10.1021/acsnano.6c13408',
                published: { 'date-parts': [[2026, 11, 25]] },
                author: [{ given: 'Mingxuan', family: 'Jia' }],
                abstract: '<jats:p>Abstract text here.</jats:p>',
            },
        ]);
        expect(acsItems).toHaveLength(1);
        expect(acsItems[0].doi).toBe('10.1021/acsnano.6c13408');
        expect(acsItems[0].description).toBe('Abstract text here.');

        const pmItems = parsePubMedSummaries(['42804948'], {
            result: {
                '42804948': {
                    uid: '42804948',
                    title: 'Prompt Engineering for Clinical LLM Workflows.',
                    sortpubdate: '2026/11/20 00:00',
                    source: 'JAMA',
                    authors: [{ name: 'Smith J' }],
                },
            },
        });
        expect(pmItems).toHaveLength(1);
        expect(pmItems[0].link).toBe('https://pubmed.ncbi.nlm.nih.gov/42804948/');
        expect(pmItems[0].title).toBe('Prompt Engineering for Clinical LLM Workflows');
    });

    it('parses Bio-IT World dated news links and ABA Law Technology Today fallback cards', () => {
        const bioHtml = `
            <article>
                <a href="/news/2026/11/25/before-a-life-sciences-dispute-escalates"><h3>Before a Life Sciences Dispute Escalates</h3></a>
                <p>Mediation vs arbitration insights.</p>
            </article>
        `;
        const bioItems = parseBioItWorldNews(bioHtml);
        expect(bioItems).toHaveLength(1);
        expect(bioItems[0].link).toBe('https://www.bio-itworld.com/news/2026/11/25/before-a-life-sciences-dispute-escalates');
        expect(bioItems[0].pubDate).toBeInstanceOf(Date);

        const abaHtml = `
            <article>
                <a href="/groups/law_practice/resources/law-technology-today/2026/when-should-lawyers-disclose-ai-use/">
                    <h3>When Should Lawyers Disclose AI Use?</h3>
                </a>
                <span>Nov 12, 2026</span>
                <p>Practical ethics guidance for legal teams.</p>
            </article>
        `;
        const abaItems = parseLawTechnologyToday(abaHtml);
        expect(abaItems).toHaveLength(1);
        expect(abaItems[0].link).toBe('https://www.americanbar.org/groups/law_practice/resources/law-technology-today/2026/when-should-lawyers-disclose-ai-use/');
        expect(abaItems[0].pubDate).toBeInstanceOf(Date);
    });
});
