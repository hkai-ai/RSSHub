import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import { JSDOM } from 'jsdom';

/**
 * 阿里巴巴云新闻文章数据接口
 */
interface AlibabaCloudArticle {
    contentArrItem?: Array<{
        year: string;
        date: string;
        readMoreText: string;
        readMoreLink: string;
        description: string;
        heading: string;
    }>;
    year?: string;
    date?: string;
    readMoreText?: string;
    readMoreLink?: string;
    description?: string;
    heading?: string;
}

/**
 * 窗口对象中的新闻页面数据结构
 */
interface PressPageData {
    openTarget: string;
    tab0: AlibabaCloudArticle[];
}

export const route: Route = {
    path: '/press-room',
    categories: ['new-media'],
    example: '/alibabacloud/press-room',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Press Room',
    maintainers: ['claude-ai'],
    handler,
};

async function handler() {
    const targetUrl = 'https://www.alibabacloud.com/zh/press-room';

    // 获取页面内容
    const htmlContent = await got({
        method: 'get',
        url: targetUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
    });

    if (!htmlContent.data || htmlContent.data.trim() === '') {
        throw new Error('获取阿里巴巴云新闻页面失败，返回内容为空');
    }

    // 使用 JSDOM 解析 HTML 内容，但不执行脚本
    const dom = new JSDOM(htmlContent.data, {
        runScripts: 'outside-only',
    });

    // 查找包含 window.pressPageData 的 script 标签
    const scriptTags = dom.window.document.querySelectorAll('script');
    let pressPageDataScript: string | null = null;

    for (const script of scriptTags) {
        if (script.textContent && script.textContent.includes('window.pressPageData')) {
            pressPageDataScript = script.textContent;
            break;
        }
    }

    if (!pressPageDataScript) {
        // 如果找不到script，尝试直接用正则提取
        const pressPageDataMatch = htmlContent.data.match(/window\.pressPageData\s*=\s*({[\s\S]*?});/);
        if (pressPageDataMatch) {
            pressPageDataScript = `window.pressPageData = ${pressPageDataMatch[1]};`;
        } else {
            throw new Error('未找到包含 window.pressPageData 的数据');
        }
    }

    // 执行脚本以获取 pressPageData
    const window = dom.window as any;
    try {
        // 创建一个安全的执行环境，只执行数据赋值部分
        // eslint-disable-next-line no-new-func
        const scriptFunction = new Function('window', pressPageDataScript);
        scriptFunction(window);
    } catch (error) {
        throw new Error(`执行 pressPageData 脚本失败: ${error}`);
    }

    // 获取解析后的数据
    const pressPageData: PressPageData = window.pressPageData;

    if (!pressPageData || !pressPageData.tab0) {
        throw new Error('未找到 pressPageData.tab0 数据或数据格式不正确');
    }

    // 提取文章数组
    const articles: AlibabaCloudArticle[] = pressPageData.tab0;

    if (!articles || !Array.isArray(articles)) {
        throw new Error('未找到文章数组或数据格式不正确');
    }

    const items = [];

    // 转换为 RSS 数据格式
    for (const article of articles) {
        // 处理嵌套的 contentArrItem 数组
        if (article.contentArrItem && Array.isArray(article.contentArrItem)) {
            for (const item of article.contentArrItem) {
                if (item.heading && item.readMoreLink) {
                    items.push(convertToRSSItem(item));
                }
            }
        } else if (article.heading && article.readMoreLink) {
            // 处理直接的文章对象
            items.push(convertToRSSItem(article));
        }
    }

    // 清理 DOM
    dom.window.close();

    // 按日期排序（最新的在前）并返回前20条
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return {
        title: 'Alibaba Cloud - Press Room',
        link: targetUrl,
        description: 'Latest press releases and news from Alibaba Cloud',
        item: items.slice(0, 20),
    };
}

/**
 * 将阿里巴巴云文章数据转换为RSS格式
 */
function convertToRSSItem(article: AlibabaCloudArticle) {
    // 解析日期格式
    const publishTime = parseAlibabaDate(article.year || '2025', article.date || '');

    // 处理相对链接，添加域名前缀
    const articleUrl = normalizeUrl(article.readMoreLink || '');

    return {
        title: article.heading?.trim() || '',
        description: article.description?.trim() || '',
        link: articleUrl,
        pubDate: publishTime,
    };
}

/**
 * 解析阿里巴巴云的日期格式
 * @param year 年份字符串，如 "2025"
 * @param date 日期字符串，如 "Aug 27"
 * @returns Date 对象
 */
function parseAlibabaDate(year: string, date: string): Date {
    if (!date || !year) {
        return new Date();
    }

    try {
        // 将 "Aug 27" 格式转换为完整日期字符串 "Aug 27, 2025"
        const fullDateString = `${date}, ${year}`;
        const parsedDate = timezone(parseDate(fullDateString), +0);

        // 验证日期是否有效
        if (Number.isNaN(parsedDate.getTime())) {
            return new Date();
        }

        return parsedDate;
    } catch {
        return new Date();
    }
}

/**
 * 规范化URL，将相对链接转换为绝对链接
 * @param url 原始URL
 * @returns 规范化后的绝对URL
 */
function normalizeUrl(url: string): string {
    if (!url) {
        return '';
    }

    // 如果已经是绝对链接，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // 如果是相对链接，添加域名前缀
    const baseUrl = 'https://www.alibabacloud.com';

    // 如果URL以斜杠开头，直接拼接
    if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
    }

    // 如果URL不以斜杠开头，添加斜杠后拼接
    return `${baseUrl}/${url}`;
}
