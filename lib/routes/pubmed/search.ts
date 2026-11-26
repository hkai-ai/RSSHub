import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

interface PubMedSummaryAuthor {
    name?: string;
}

interface PubMedSummaryRecord {
    uid?: string;
    title?: string;
    pubdate?: string;
    sortpubdate?: string;
    source?: string;
    fulljournalname?: string;
    authors?: PubMedSummaryAuthor[];
}

interface PubMedSummaryPayload {
    result?: Record<string, PubMedSummaryRecord | string[]>;
}

export const parsePubMedSummaries = (ids: string[], payload: PubMedSummaryPayload): DataItem[] => {
    const result = payload?.result ?? {};
    const items: DataItem[] = [];
    for (const id of ids) {
        const rec = result[id];
        if (!rec || Array.isArray(rec)) {
            continue;
        }
        const title = (rec.title ?? '').replaceAll(/\s+/g, ' ').replace(/\.$/, '').trim();
        if (!title) {
            continue;
        }
        const link = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
        const authors = (rec.authors ?? [])
            .map((a) => a.name?.trim())
            .filter(Boolean)
            .join(', ');
        const journal = rec.fulljournalname || rec.source || 'PubMed';
        const rawDate = rec.sortpubdate || rec.pubdate || '';
        const parsed = rawDate ? parseDate(rawDate.replaceAll('/', '-')) : undefined;
        const descParts = [
            `<p><strong>Journal:</strong> ${journal}</p>`,
            authors ? `<p><strong>Authors:</strong> ${authors}</p>` : '',
            rec.pubdate ? `<p><strong>Published:</strong> ${rec.pubdate}</p>` : '',
            `<p><a href="${link}">Read on PubMed (PMID: ${id})</a></p>`,
        ].filter(Boolean);

        items.push({
            title,
            link,
            guid: `pubmed:${id}`,
            author: authors || journal,
            description: descParts.join(''),
            ...(parsed && !Number.isNaN(parsed.getTime()) ? { pubDate: parsed } : {}),
        });
    }
    return items;
};

export const route: Route = {
    path: '/search/:query',
    name: 'Search Results',
    categories: ['journal'],
    example: '/pubmed/search/prompt+engineering',
    parameters: {
        query: 'PubMed search query string (URL-encoded)',
    },
    maintainers: ['claude'],
    description: 'Latest PubMed articles matching a query via official NCBI E-utilities.',
    url: 'pubmed.ncbi.nlm.nih.gov',
    handler: async (ctx) => {
        const query = decodeURIComponent(ctx.req.param('query') ?? '').trim();
        if (!query) {
            throw new Error('PubMed search query is required');
        }
        const searchRes = await ofetch<{ esearchresult?: { idlist?: string[] } }>('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
            query: {
                db: 'pubmed',
                term: query,
                sort: 'pub date',
                retmode: 'json',
                retmax: 25,
            },
        });
        const ids = searchRes?.esearchresult?.idlist ?? [];
        if (!ids.length) {
            throw new Error(`No PubMed articles found for query: ${query}`);
        }
        const summaryRes = await ofetch<PubMedSummaryPayload>('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
            query: {
                db: 'pubmed',
                id: ids.join(','),
                retmode: 'json',
            },
        });
        const item = parsePubMedSummaries(ids, summaryRes);
        return {
            title: `PubMed Search: ${query}`,
            link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}&sort=date`,
            item,
        };
    },
};
