import type { DataItem } from '@/types';
import { parseDate } from '@/utils/parse-date';

export type JinaPost = { title: string; slug: string; html?: string; published_at?: string; updated_at?: string; authors?: Array<{ name: string }>; tags?: Array<{ name: string }> };

/** The key is the public read-only Ghost Content API key shipped by the official site. */
export const extractJinaContentKey = (script: string): string | undefined => script.match(/key:["']([a-f\d]+)["']/)?.[1];

export const mapJinaPosts = (posts: JinaPost[]): DataItem[] =>
    posts
        .filter((post) => post.title && /^[\w-]+$/.test(post.slug))
        .map((post) => {
            const date = post.published_at ? parseDate(post.published_at) : undefined;
            const updated = post.updated_at ? parseDate(post.updated_at) : undefined;
            return {
                title: post.title,
                link: `https://jina.ai/news/${post.slug}/`,
                description: post.html,
                pubDate: date && !Number.isNaN(date.getTime()) ? date : undefined,
                updated: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
                author: post.authors?.map((author) => author.name).join(', '),
                category: post.tags?.map((tag) => tag.name),
            };
        });
