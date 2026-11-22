import { escapeAttribute, escapeText } from 'entities';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { productDate, requireProductItems } from '@/utils/product-updates';

interface RichNode {
    type: string;
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type: string; attrs?: { href?: string } }>;
    content?: RichNode[];
}

interface ChangeResponse {
    code: number;
    data?: { page_list: Array<{ page_info: { page_id: string; title: string; content: string; create_time?: string } }> };
}

const link = 'https://skywork.ai/help/changelog?id=019a3477-3b14-748b-af15-309ded92c8d4';
const safeUrl = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return;
    }
    try {
        const url = new URL(value, link);
        return ['http:', 'https:'].includes(url.protocol) ? escapeAttribute(url.href) : undefined;
    } catch {
        return;
    }
};

export const renderChangeNode = (node: RichNode): string => {
    if (node.type === 'text') {
        const text = escapeText(node.text ?? '');
        const href = safeUrl(node.marks?.find((mark) => mark.type === 'link')?.attrs?.href);
        return href ? `<a href="${href}">${text}</a>` : text;
    }
    if (node.type === 'image') {
        const src = safeUrl(node.attrs?.cdnsrc ?? node.attrs?.src);
        return src ? `<p><img src="${src}"></p>` : '';
    }
    if (node.type === 'hardBreak') {
        return '<br>';
    }
    const content = (node.content ?? []).map((child) => renderChangeNode(child)).join('');
    const tags: Record<string, string> = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', codeBlock: 'pre', table: 'table', tableRow: 'tr', tableCell: 'td', tableHeader: 'th' };
    const tag = node.type === 'heading' ? `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))}` : tags[node.type];
    return tag ? `<${tag}>${content}</${tag}>` : content;
};

export const parseChanges = (response: ChangeResponse) =>
    requireProductItems(
        response.code === 0
            ? (response.data?.page_list ?? []).map(({ page_info: page }) => ({
                  title: page.title,
                  link,
                  guid: `skywork-changelog:${page.page_id}`,
                  description: renderChangeNode(JSON.parse(page.content)),
                  pubDate: productDate(page.create_time),
                  author: 'Skywork',
              }))
            : [],
        'Skywork官方更新日志'
    );

export const route: Route = {
    path: '/changelog',
    name: '官方更新日志',
    categories: ['program-update'],
    example: '/skywork/changelog',
    maintainers: ['hkai-ai'],
    description: 'Reads the public API used by the official Changelog linked from the Skywork website. Includes first-party product announcements only. Source dates are preserved without inventing a publication time.',
    features: { requireConfig: false, requirePuppeteer: false },
    handler: async () => ({
        title: 'Skywork 官方更新日志',
        link,
        item: parseChanges(
            await ofetch<ChangeResponse>('https://api.skywork.ai/nova/help_center/page_info', {
                method: 'POST',
                body: { req_plat_from: 'web', id: '019a3477-3b14-748b-af15-309ded92c8d4', label_filter: '', page_num: 1, page_size: 10 },
                responseType: 'json',
            })
        ),
    }),
};
