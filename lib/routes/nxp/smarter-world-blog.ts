import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/smarter-world-blog/:category?',
    name: 'Smarter World Blog',
    categories: ['programming'],
    example: '/nxp/smarter-world-blog/c36',
    parameters: {
        category: 'applicationTax 分类代码（可选），例如 c36 代表汽车电子分类。不传参数则返回所有分类的博客',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.nxp.com.cn/company/about-nxp/smarter-world-blog:BLOGS'],
            target: '/smarter-world-blog',
        },
        {
            source: ['www.nxp.com.cn/company/about-nxp/smarter-world-blog:BLOGS'],
            target: (params, url) => {
                const urlObj = new URL(url);
                const query = urlObj.searchParams.get('query');
                if (query) {
                    const match = query.match(/applicationTax>>(\w+)/);
                    if (match) {
                        return `/smarter-world-blog/${match[1]}`;
                    }
                }
                return '/smarter-world-blog';
            },
        },
    ],
    maintainers: ['claude'],
    handler: async (ctx) => {
        const { category } = ctx.req.param();

        // Build API URL parameters
        const params: string[] = ['collection=Blogs', 'start=0', 'max=20', 'sorting=sort_date.desc', 'language=cn', 'parameters=applicationTax.Topics.blog_language', 'app=blogs'];

        if (category) {
            params.push(`query=applicationTax>>${category}`);
        }

        // Build API URL in special format: /allResults/{param1&param2&...}
        const apiUrl = `https://www.nxp.com.cn/webapp-rest/api/search/getAsset/allResults/{${params.join('&')}}`;

        const response = await ofetch(apiUrl);

        const items = response.results.map((item) => {
            const metadata = item.metaData || {};

            // Extract categories from ApplicationTags field (format: "汽车电子::c36")
            let categories: string[] | undefined;
            if (metadata.ApplicationTags && typeof metadata.ApplicationTags === 'string') {
                categories = metadata.ApplicationTags.split('::');
            }

            return {
                title: metadata.page_title_s || item.title || '',
                link: item.url || '',
                description: metadata.search_summary || item.summary || '',
                author: metadata.author_name || '',
                pubDate: metadata.blog_pub_dte ? timezone(parseDate(metadata.blog_pub_dte), 0) : metadata.sort_date ? timezone(parseDate(metadata.sort_date), 0) : undefined,
                category: categories,
            };
        });

        return {
            title: category ? `NXP Smarter World Blog - ${category}` : 'NXP Smarter World Blog',
            link: category ? `https://www.nxp.com.cn/company/about-nxp/smarter-world-blog:BLOGS?query=applicationTax>>${category}` : 'https://www.nxp.com.cn/company/about-nxp/smarter-world-blog:BLOGS',
            description: 'NXP恩智浦半导体智慧生活博客',
            language: 'zh-CN',
            item: items,
        };
    },
};
