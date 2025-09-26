import { Route } from '@/types';
import { parseDate } from '@/utils/parse-date';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parse } from 'yaml';

export const route: Route = {
    path: '/cookbook',
    categories: ['programming'],
    description:
        'OpenAI Cookbook 提供了大量使用 OpenAI API 的实用指南和示例代码,涵盖了从基础到高级的各种主题,包括 GPT 模型、嵌入、函数调用、微调等。这里汇集了最新的 API 功能介绍和流行的应用案例,是开发者学习和应用 OpenAI 技术的宝贵资源。',
    maintainers: ['liyaozhong'],
    radar: [
        {
            source: ['cookbook.openai.com/'],
        },
    ],
    url: 'cookbook.openai.com/',
    handler,
    example: '/openai/cookbook',
    name: 'Cookbook',
};

async function handler() {
    const rootUrl = 'https://cookbook.openai.com';
    const currentUrl = `${rootUrl}/`;
    const registryUrl = 'https://raw.githubusercontent.com/openai/openai-cookbook/refs/heads/main/registry.yaml';

    try {
        const response = await ofetch(registryUrl, { parseResponse: (txt) => txt });
        const registry = parse(response) as Array<{
            title: string;
            path: string;
            date: string;
            authors?: string[];
            tags?: string[];
            archived?: boolean;
        }>;

        const items = registry
            .filter((entry) => !entry.archived)
            .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 50)
            .map((entry) => {
                const pathWithoutExtension = entry.path.replace(/\.(ipynb|md)$/, '').toLowerCase();

                return {
                    title: entry.title,
                    link: `${rootUrl}/${pathWithoutExtension}`,
                    description: `作者: ${entry.authors?.join(', ') || 'OpenAI'}<br>标签: ${entry.tags?.join(', ') || ''}`,
                    pubDate: parseDate(entry.date),
                    author: entry.authors?.join(', ') || 'OpenAI',
                    category: entry.tags || [],
                };
            });

        return {
            title: 'OpenAI Cookbook',
            link: currentUrl,
            description: 'OpenAI Cookbook 提供了大量使用 OpenAI API 的实用指南和示例代码',
            item: items,
        };
    } catch (error) {
        logger.error(`处理 OpenAI Cookbook 请求时发生错误: ${error}`);
        throw error;
    }
}
