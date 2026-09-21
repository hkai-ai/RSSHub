import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import ofetch from '@/utils/ofetch';

import { handler } from './routes/cognition/blog';

vi.mock('@/utils/ofetch', () => ({ default: vi.fn() }));

const fixture = readFileSync(new URL('../tests/cognition/fixtures/blog.html', import.meta.url), 'utf8');
const context = { req: { param: () => ({}) } };

describe('Cognition blog redesign', () => {
    it('discovers the Series E announcement with its original date and canonical link', async () => {
        vi.mocked(ofetch).mockResolvedValue(fixture);
        const feed = await handler(context);
        expect(ofetch).toHaveBeenCalledWith('https://cognition.com/blog');
        expect(feed.item).toHaveLength(6);
        const item = feed.item.find((entry) => entry.link === 'https://cognition.com/blog/series-e');
        expect(item?.title?.trim()).toBe('Do it all with Devin: Announcing our Series E');
        expect(item?.description).toContain('$2B');
        const date = new Date(item!.pubDate!);
        expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 9, 8]);
    });

    it('rejects a changed or empty page instead of reporting an empty successful feed', async () => {
        vi.mocked(ofetch).mockResolvedValue('<html><main>No blog list</main></html>');
        await expect(handler(context)).rejects.toThrow('No Cognition blog articles found');
    });

    it('does not emit duplicate article links', async () => {
        vi.mocked(ofetch).mockResolvedValue(fixture.replace('</ul>', `${fixture.match(/<li>.*?<\/li>/s)![0]}</ul>`));
        expect((await handler(context)).item).toHaveLength(6);
    });
});
