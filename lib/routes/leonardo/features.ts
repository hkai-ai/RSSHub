import type { Route } from '@/types';
import { fetchHelpUpdates } from '@/utils/help-center-updates';

const link = 'https://intercom.help/leonardo-ai/en/collections/5295455-feature-releases';
export const route: Route = {
    path: '/features',
    name: 'Feature Releases',
    categories: ['program-update'],
    example: '/leonardo/features',
    maintainers: ['hkai-ai'],
    description: 'Official feature-release documentation. Dates represent the help center’s stated document update time, not an inferred original product launch date.',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'Leonardo.Ai Feature Releases', link, item: await fetchHelpUpdates(link) }),
};
