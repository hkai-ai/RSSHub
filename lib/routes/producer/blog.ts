import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';

import { parseProducerAnnouncements } from './pure';

export const route: Route = {
    path: '/blog',
    name: 'Blog',
    categories: ['multimedia'],
    example: '/producer/blog',
    maintainers: ['claude'],
    url: 'www.flowmusic.app',
    description: 'ProducerAI is now Google Flow Music. This compatibility route includes only official Google Labs RSS entries explicitly naming Flow Music or ProducerAI; it covers the recent RSS window, not the historical archive.',
    radar: [{ source: ['www.producer.ai/blog', 'www.producer.ai/blog/*', 'www.flowmusic.app'], target: '/blog' }],
    handler: async () => {
        const xml = await ofetch('https://blog.google/innovation-and-ai/models-and-research/google-labs/rss/', { responseType: 'text' });
        const item = await parseProducerAnnouncements(xml);
        return {
            title: 'Google Flow Music (formerly ProducerAI)',
            link: 'https://www.flowmusic.app/',
            description: 'Official Google Labs announcements about Flow Music and ProducerAI',
            language: 'en',
            allowEmpty: true,
            item,
        };
    },
};
