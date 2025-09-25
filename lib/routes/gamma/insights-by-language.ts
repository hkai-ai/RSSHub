import { Route } from '@/types';
import { unlockWebsite } from '@/utils/bright-data-unlocker';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

export const route: Route = {
    path: '/insights/:lang?',
    name: 'Insights Blog by Language',
    categories: ['programming', 'new-media'],
    example: '/gamma/insights/zh-cn',
    parameters: {
        lang: {
            description: 'Language code (e.g., zh-cn, de, es, fr, pt-br, ar, ja, zh-tw, ko)',
            default: 'en (English)',
        },
    },
    features: {
        requireConfig: [
            {
                name: 'BRIGHTDATA_API_KEY',
                description: 'Bright Data API key for bypassing anti-bot measures',
            },
            {
                name: 'BRIGHTDATA_UNLOCKER_ZONE',
                description: 'Bright Data zone identifier for web unlocker',
            },
        ],
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['gamma.app/insights', 'gamma.app/:lang/insights'],
            target: '/insights/:lang',
        },
    ],
    maintainers: ['claude'],
    handler,
};

// Language mappings
const languageMap: Record<string, string> = {
    en: '',
    de: '/de',
    es: '/es',
    fr: '/fr',
    'pt-br': '/pt-br',
    ar: '/ar',
    ja: '/ja',
    'zh-cn': '/zh-cn',
    'zh-tw': '/zh-tw',
    ko: '/ko',
};

const languageNames: Record<string, string> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    'pt-br': 'Português (Brasil)',
    ar: 'العربية',
    ja: '日本語',
    'zh-cn': '简体中文',
    'zh-tw': '繁體中文',
    ko: '한국어',
};

async function handler(ctx) {
    const { lang = 'en' } = ctx.req.param();
    const baseUrl = 'https://gamma.app';
    const langPrefix = languageMap[lang] || '';
    const insightsUrl = `${baseUrl}${langPrefix}/insights`;

    return await cache.tryGet(
        insightsUrl,
        async () => {
            const response = await unlockWebsite(insightsUrl);
            const $ = load(response);

            const items: Array<{
                title: string;
                link: string;
                description: string;
                author: string;
                pubDate: Date;
                category: string | string[];
                image: string | undefined;
            }> = [];

            // Extract articles from the page
            $('.chakra-linkbox.css-89dcg6').each((_, element) => {
                const $article = $(element);

                // Get title
                const title = $article.find('h2 a').first().text().trim();

                // Get link
                const link = $article.find('h2 a').first().attr('href');

                // Get date
                const dateText = $article.find('.css-6iyxuc').first().text().trim();
                let pubDate;

                // Handle different language date formats
                if (dateText) {
                    // Portuguese: "16 de setembro de 2025"
                    // Spanish: "16 de septiembre de 2025"
                    // French: "16 septembre 2025"
                    // German: "16. September 2025"
                    // Chinese: "2025年9月16日"
                    if (dateText.includes('年') && dateText.includes('月') && dateText.includes('日')) {
                        // Handle Chinese format: "2025年9月16日"
                        const yearMatch = dateText.match(/(\d{4})年/);
                        const monthMatch = dateText.match(/(\d{1,2})月/);
                        const dayMatch = dateText.match(/(\d{1,2})日/);

                        if (yearMatch && monthMatch && dayMatch) {
                            const year = yearMatch[1];
                            const month = monthMatch[1].padStart(2, '0');
                            const day = dayMatch[1].padStart(2, '0');
                            pubDate = parseDate(`${year}-${month}-${day}`);
                        }
                    } else if (dateText.includes('de ')) {
                        // Handle Portuguese/Spanish format
                        const monthMap = {
                            janeiro: '01',
                            fevereiro: '02',
                            março: '03',
                            abril: '04',
                            maio: '05',
                            junho: '06',
                            julho: '07',
                            agosto: '08',
                            setembro: '09',
                            outubro: '10',
                            novembro: '11',
                            dezembro: '12',
                            enero: '01',
                            febrero: '02',
                            marzo: '03',
                            abril: '04',
                            mayo: '05',
                            junio: '06',
                            julio: '07',
                            agosto: '08',
                            septiembre: '09',
                            octubre: '10',
                            noviembre: '11',
                            diciembre: '12',
                        };

                        const parts = dateText.replace('de ', '').replace(' de ', ' ').split(' ');
                        if (parts.length === 3) {
                            const day = parts[0].padStart(2, '0');
                            const month = monthMap[parts[1].toLowerCase()] || parts[1];
                            const year = parts[2];
                            pubDate = parseDate(`${year}-${month}-${day}`);
                        }
                    } else {
                        // Fallback to default parser
                        pubDate = parseDate(dateText);
                    }
                }

                // Get category
                const category = $article.find('.css-1rwhchs').first().text().trim();

                // Get author
                const author = $article.find('.css-1krxe8n').first().text().trim();

                // Get image
                const image = $article.find('img').first().attr('src');

                if (title && link) {
                    items.push({
                        title,
                        link: link.startsWith('http') ? link : `${baseUrl}${link}`,
                        description: '', // Will be populated below
                        author,
                        pubDate,
                        category,
                        image: image ? (image.startsWith('http') ? image : `${baseUrl}${image}`) : undefined,
                    });
                }
            });

            // Get full content for each article
            const fullItems = await Promise.all(
                items.map((item) =>
                    cache.tryGet(item.link, async () => {
                        try {
                            const articleResponse = await unlockWebsite(item.link);
                            const $article = load(articleResponse);

                            // Extract article content
                            const content = $article('.css-17xejub').first().html() || '';

                            return {
                                ...item,
                                description: content,
                            };
                        } catch (error) {
                            logger.error(`Failed to fetch article content for ${item.link}:`, error);
                            return item;
                        }
                    })
                )
            );

            const langName = languageNames[lang] || 'English';

            return {
                title: `Gamma Insights (${langName})`,
                link: insightsUrl,
                description: `Latest insights, updates, and thought leadership from the Gamma team in ${langName}`,
                item: fullItems,
            };
        },
        300
    ); // Cache for 5 minutes
}
