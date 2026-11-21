import type { Route } from '@/types';
import { fetchHelpUpdates } from '@/utils/help-center-updates';

const link = 'https://help.meshy.ai/en/collections/10642994-features';
export const route: Route = {
    path: '/features',
    name: 'Feature Documentation Updates',
    categories: ['program-update'],
    example: '/meshy/features',
    maintainers: ['hkai-ai'],
    description: 'Official feature-guide updates, including Meshy Agent and generation tools. Dates represent documentation updates; this is not a complete release-history feed.',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({ title: 'Meshy Feature Documentation Updates', link, item: await fetchHelpUpdates(link) }),
};
