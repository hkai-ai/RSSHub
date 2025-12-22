import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';

import type { Route } from '@/types';
import { ViewType } from '@/types';
import { parseDate } from '@/utils/parse-date';
import { getPuppeteerPage } from '@/utils/puppeteer';

export const route: Route = {
    path: '/topics/:topic',
    categories: ['traditional-media'],
    view: ViewType.Articles,
    example: '/economist/topics/artificial-intelligence',
    parameters: {
        topic: 'Topic slug, can be found in the URL path, e.g. artificial-intelligence',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['economist.com/topics/:topic'],
            target: '/topics/:topic',
        },
    ],
    name: 'Topics',
    maintainers: ['Claude'],
    handler,
    url: 'economist.com/topics/*',
};

async function handler(ctx) {
    const { topic } = ctx.req.param();
    const link = `https://www.economist.com/topics/${topic}`;
    const { page, destory } = await getPuppeteerPage(link, {
        gotoConfig: { waitUntil: 'networkidle0' },
    });

    const html = await page.content();
    await destory();

    const $ = load(html);
    const scriptContent = $('script#__NEXT_DATA__').text();
    if (!scriptContent) {
        throw new Error('Unable to find Next.js data');
    }

    const nextData = JSON.parse(scriptContent);

    const { content, metadata } = nextData.props.pageProps;

    if (!content || !content.articles) {
        throw new Error('No articles found for this topic');
    }

    const items = content.articles.map((article) => {
        const title = article.headline || article.rubric || 'Untitled';
        const description = article.rubric ? `${article.rubric}${article.flyTitle ? ` | ${article.flyTitle}` : ''}` : article.flyTitle || '';

        // Build full article URL
        const articleUrl = `https://www.economist.com${article.url}`;

        return {
            title: sanitizeHtml(title, { allowedTags: [], allowedAttributes: {} }),
            link: articleUrl,
            pubDate: parseDate(article.datePublished),
            description: sanitizeHtml(description, {
                allowedTags: ['br', 'p', 'strong', 'em'],
                allowedAttributes: {},
            }),
            category: article.section?.name ? [article.section?.name] : [],
            guid: article.id || articleUrl,
        };
    });

    return {
        title: String(metadata.title || content.headline || 'The Economist Topics'),
        link,
        description: metadata.description || content.description || `Latest articles about ${topic.replace('-', ' ')}`,
        language: 'en-gb' as const,
        image: metadata.imageUrl || 'https://www.economist.com/engassets/google-search-logo.png',
        item: items,
    };
}
