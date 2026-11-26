import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

interface CrossrefAuthor {
    given?: string;
    family?: string;
    name?: string;
}

interface CrossrefWorkItem {
    title?: string[];
    DOI?: string;
    URL?: string;
    abstract?: string;
    author?: CrossrefAuthor[];
    'container-title'?: string[];
    published?: { 'date-parts'?: number[][] };
    created?: { 'date-parts'?: number[][] };
}

export const parseCrossrefWorks = (works: CrossrefWorkItem[]): DataItem[] => {
    const items: DataItem[] = [];
    for (const work of works) {
        const title = (work.title?.[0] ?? '').replaceAll(/\s+/g, ' ').trim();
        const doi = work.DOI?.trim();
        const link = work.URL?.trim() || (doi ? `https://doi.org/${doi}` : '');
        if (!title || !link) {
            continue;
        }
        const parts = work.published?.['date-parts']?.[0] || work.created?.['date-parts']?.[0];
        const pubDate = parts?.length ? parseDate(`${parts[0]}-${String(parts[1] ?? 1).padStart(2, '0')}-${String(parts[2] ?? 1).padStart(2, '0')}`) : undefined;
        const author = (work.author ?? [])
            .map((a) => a.name?.trim() || [a.given, a.family].filter(Boolean).join(' ').trim())
            .filter(Boolean)
            .join(', ');
        const cleanAbstract = (work.abstract ?? '').replaceAll(/<\/?jats:[^>]+>/gi, '').trim();
        const description = cleanAbstract || (author ? `<p>${author}</p>` : title);

        items.push({
            title,
            link,
            guid: doi || link,
            doi,
            author: author || undefined,
            description,
            ...(pubDate && !Number.isNaN(pubDate.getTime()) ? { pubDate } : {}),
        });
    }
    return items;
};

export const route: Route = {
    path: '/journal/:issn',
    name: 'Journal Works by ISSN',
    categories: ['journal'],
    example: '/crossref/journal/2375-2548',
    parameters: {
        issn: 'Journal ISSN (e.g. 2375-2548 for Science Advances)',
    },
    maintainers: ['claude'],
    description: 'Latest published works for an academic journal via official Crossref REST API.',
    url: 'www.crossref.org',
    handler: async (ctx) => {
        const issn = (ctx.req.param('issn') ?? '').trim();
        if (!/^\d{4}-[\dX]{4}$/i.test(issn)) {
            throw new Error(`Invalid ISSN format: ${issn}`);
        }
        const res = await ofetch<{ message?: { items?: CrossrefWorkItem[] } }>(`https://api.crossref.org/journals/${encodeURIComponent(issn)}/works`, {
            query: { rows: 25, sort: 'published', order: 'desc' },
        });
        const works = res?.message?.items ?? [];
        const item = parseCrossrefWorks(works);
        if (!item.length) {
            throw new Error(`No works found in Crossref for ISSN ${issn}`);
        }
        const journalTitle = works[0]?.['container-title']?.[0]?.trim() || `Crossref Journal ${issn}`;
        return {
            title: journalTitle,
            link: `https://api.crossref.org/journals/${issn}`,
            item,
        };
    },
};
