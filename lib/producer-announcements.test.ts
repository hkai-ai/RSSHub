import { describe, expect, it } from 'vitest';

import { parseProducerAnnouncements } from './routes/producer/pure';

const item = (title: string, path: string, description = '') =>
    `<item><title>${title}</title><link>https://blog.google/${path}/</link><description>${description}</description><pubDate>Tue, 06 Oct 2026 16:00:00 +0000</pubDate><og><title>Ignore nested metadata</title></og></item>`;

describe('ProducerAI migration announcements', () => {
    it('keeps explicitly named music announcements and excludes Flow video and unrelated Labs news', async () => {
        const entries = await parseProducerAnnouncements(
            `<rss version="2.0"><channel>${item('Google Flow Music tools', 'music')}${item('ProducerAI joins Google', 'producer')}${item('New music model', 'model', 'Available in Flow Music')}${item('New Google Flow tools for filmmakers', 'video')}${item('Google Labs news', 'labs')}</channel></rss>`
        );
        expect(entries.map((entry) => entry.title)).toEqual(['Google Flow Music tools', 'ProducerAI joins Google', 'New music model']);
        expect((entries[0].pubDate as Date).toISOString()).toBe('2026-10-06T16:00:00.000Z');
    });

    it('rejects foreign links, deduplicates canonical URLs and does not invent dates', async () => {
        const xml = `<rss version="2.0"><channel>${item('Flow Music', 'music')}${item('Flow Music', 'music')}<item><title>ProducerAI news</title><link>https://blog.google/new/</link></item><item><title>Flow Music</title><link>https://blog.google.attacker.test/music/</link></item></channel></rss>`;
        const entries = await parseProducerAnnouncements(xml);
        expect(entries).toHaveLength(2);
        expect(entries[1].pubDate).toBeUndefined();
    });

    it('allows a valid RSS window without product matches but rejects invalid upstream responses', async () => {
        await expect(parseProducerAnnouncements(`<rss version="2.0"><channel>${item('New Google Flow tools for filmmakers', 'video')}</channel></rss>`)).resolves.toEqual([]);
        await expect(parseProducerAnnouncements('<html>Flow Music</html>')).rejects.toThrow();
        await expect(parseProducerAnnouncements(`<rss version="2.0"><channel>${item('Flow Music', 'music')}</rss>`)).rejects.toThrow();
        await expect(parseProducerAnnouncements('<rss version="2.0"><channel/></rss>')).rejects.toThrow();
    });
});
