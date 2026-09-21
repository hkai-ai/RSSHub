import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import ofetch from '@/utils/ofetch';

import { parseResearch } from './routes/anthropic/research';
import { handler, parsePosts } from './routes/suno/blog';

vi.mock('@/utils/ofetch', () => ({ default: vi.fn() }));
const suno = readFileSync(new URL('../tests/suno/fixtures/page.html', import.meta.url), 'utf8');
const research = readFileSync(new URL('../tests/anthropic/fixtures/page.html', import.meta.url), 'utf8');

describe('Suno redesigned blog', () => {
    it('includes the featured v6 announcement with exact timestamp and tags', () => {
        const items = parsePosts(suno);
        expect(items).toHaveLength(45);
        expect(items[0]).toMatchObject({ title: 'Introducing v6', link: 'https://suno.com/blog/introducing-v6', category: ['Announcements', 'Product Update', 'Partnerships'] });
        expect(new Date(items[0].pubDate!).toISOString()).toBe('2026-09-09T15:40:00.000Z');
        expect(new Set(items.map((item) => item.link)).size).toBe(items.length);
    });
    it('keeps full and Product Update feeds independent in either request order', async () => {
        vi.mocked(ofetch).mockResolvedValue(suno);
        const filtered = await handler({ req: { param: () => ({ tag: 'product+update' }) } });
        const all = await handler({ req: { param: () => ({}) } });
        expect(filtered.item[0].title).toBe('Introducing v6');
        expect(filtered.item.every((item) => item.category?.includes('Product Update'))).toBe(true);
        expect(filtered.item.length).toBeLessThan(all.item.length);
        expect(all.item).toHaveLength(45);
    });
    it('reassembles Flight records split over multiple scripts', () => {
        const match = suno.match(/push\(\[1,("(?:[^"\\]|\\.)*")\]\)/)!;
        const data: string = JSON.parse(match[1]);
        const split = data.indexOf('publishedAt') + 3;
        const html = [data.slice(0, split), data.slice(split)].map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join('');
        expect(parsePosts(html)).toEqual(parsePosts(suno));
    });
    it('fails visibly when the page no longer supplies posts', () => {
        expect(() => parsePosts('<html></html>')).toThrow('No Suno blog posts');
    });
});

describe('Anthropic Research redesigned list', () => {
    it('includes the missed security article once with its original date', () => {
        const items = parseResearch(research);
        expect(items).toHaveLength(10);
        const matching = items.filter((item) => item.link === 'https://www.anthropic.com/research/alignment-assessment-cybersecurity-incidents');
        expect(matching).toHaveLength(1);
        expect(matching[0].title).toBe('An alignment assessment of recent cybersecurity incidents');
        expect(new Date(matching[0].pubDate!).toISOString()).toBe('2026-09-09T00:00:00.000Z');
        expect(matching[0].description).toContain('four incidents');
        expect(items[0].title).toBe('How Claude is uplifting biomolecular modeling');
    });
    it('fails visibly for a changed or empty listing', () => {
        expect(() => parseResearch('<main><a href="/research/team/alignment">Alignment</a></main>')).toThrow('No Anthropic research articles');
    });
});
