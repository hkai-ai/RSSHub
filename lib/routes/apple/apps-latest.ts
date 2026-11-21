import InvalidParameterError from '@/errors/types/invalid-parameter';
import NotFoundError from '@/errors/types/not-found';
import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

interface LookupApp {
    trackId: number;
    trackName: string;
    trackViewUrl: string;
    version: string;
    sellerName?: string;
    releaseNotes?: string;
    currentVersionReleaseDate?: string;
}

export const parseLatestApp = (app: LookupApp, country: string) => ({
    title: `${app.trackName} ${app.version}`,
    link: app.trackViewUrl,
    guid: `apple-latest:${country}:${app.trackId}:${app.version}`,
    author: app.sellerName,
    description: (app.releaseNotes ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>'),
    pubDate: app.currentVersionReleaseDate ? parseDate(app.currentVersionReleaseDate) : undefined,
});

export const route: Route = {
    path: '/apps/latest/:country/:id',
    name: 'Latest App Version',
    categories: ['program-update'],
    example: '/apple/apps/latest/cn/id1500526240',
    parameters: { country: 'Two-letter App Store country code', id: 'Numeric app ID, with or without the id prefix' },
    maintainers: ['hkai-ai'],
    features: { requireConfig: false, requirePuppeteer: false },
    description: 'Tracks the latest version and release notes from the public Apple lookup API. This is a latest-version feed, not a complete version-history or user-reviews feed.',
    handler: async (ctx) => {
        const { country, id } = ctx.req.param();
        if (!/^[a-z]{2}$/.test(country) || !/^(?:id)?\d+$/.test(id)) {
            throw new InvalidParameterError('Use a two-letter country and a numeric app ID.');
        }
        const response = await ofetch<{ results: LookupApp[] }>('https://itunes.apple.com/lookup', { query: { country, id: id.replace(/^id/, '') }, responseType: 'json' });
        const app = response.results[0];
        if (!app?.version || !app.trackViewUrl) {
            throw new NotFoundError('Apple did not return an app version for this country and ID.');
        }
        return { title: `${app.trackName} - 版本更新`, link: app.trackViewUrl, item: [parseLatestApp(app, country)] };
    },
};
