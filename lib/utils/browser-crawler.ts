import { config } from '@/config';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';

/**
 * 第三方 BrowserCrawler 服务返回的响应结构。
 *
 * - 成功路径：`{ result: string | null }`。`result === null` 表示浏览器侧执行成功但没
 *   抓到任何内容（常见于页面 JS 渲染异常、元素未出现等）。
 * - 错误路径：`{ statusCode, error, message }`。服务端将浏览器侧异常归一后返回。
 */
export type BrowserCrawlerResponse =
    | {
          result: null | string;
      }
    | {
          statusCode: number;
          error: string;
          message: string;
      };

/**
 * 调用第三方 BrowserCrawler 服务时的请求参数。
 *
 * 与本地 puppeteer 的参数不完全等价，需要根据调用端口决定：
 * - `headless` 端点适合大部分场景，开销低；
 * - `chrome-remote` 端点指纹更接近真实浏览器，适合反爬严格站点。
 */
export interface BrowserCrawlerOptions {
    /** 目标页面 URL。 */
    url: string;
    /**
     * 是否禁止页面内部的资源请求（image / font / media 等），压低带宽并提速。
     * 仅需要 HTML 结构的爬取任务开启效果最明显。
     */
    isBanResourceRequest?: boolean;
    /**
     * 浏览器等待策略。
     * - `domcontentloaded`：DOM 可用即返回，速度最快；
     * - `load`：所有静态资源加载完；
     * - `networkidle`：网络空闲，适合 SPA / 异步渲染页面。
     */
    waitUntil?: 'domcontentloaded' | 'networkidle' | 'load';
    /**
     * CSS 选择器校验规则。
     *
     * 传入后由服务端直接提取命中元素的 HTML 并返回（而非完整页面），用于压缩传输
     * 体积。本仓库调用方大多需要完整 HTML 配合 cheerio，因此默认不传。
     */
    validationRule?: string;
    /** 总超时（毫秒）。 */
    timeout?: number;
}

/**
 * 判断抓到的 HTML 是否为"有效内容"，用于过滤常见反爬拦截页。
 *
 * 目前识别的拦截页特征：
 * - Cloudflare Turnstile：含 `"To continue, please click the box below..."`；
 * - DataDome CAPTCHA：含字符串 `DataDome CAPTCHA`。
 *
 * 未来遇到新的拦截页，在此按特征串追加判断即可。
 *
 * @param content 待检查的 HTML 字符串，`null` 或空字符串视为无效。
 * @returns 有效内容返回 true。
 */
export const isValidContent = (content: string | null | undefined): content is string => {
    if (!content) {
        return false;
    }
    if (content.includes("To continue, please click the box below to let us know you're not a robot.")) {
        return false;
    }
    if (content.includes('DataDome CAPTCHA')) {
        return false;
    }
    return true;
};

const postCrawler = async (endpoint: string, options: BrowserCrawlerOptions): Promise<BrowserCrawlerResponse> => {
    const baseUrl = config.browserCrawler.baseUrl.replace(/\/$/, '');
    return await ofetch<BrowserCrawlerResponse>(`${baseUrl}${endpoint}`, {
        method: 'POST',
        body: options,
        timeout: options.timeout ?? 60_000,
        retry: 0,
    });
};

/**
 * 调用第三方 BrowserCrawler 服务的 Headless 浏览器端点 (`/api/browser`)。
 *
 * 与 {@link thirdPartyCrawlerForChromeRemote} 对比：Headless 开销更低，但对强反爬
 * 站点可能不够用。调用方应优先走此端点，失败后再降级到 chrome-remote。
 *
 * @param options 爬取选项。
 * @returns 第三方服务响应；调用方自行判别成功/错误分支。
 */
export const thirdPartyCrawlerForBrowser = (options: BrowserCrawlerOptions) => postCrawler('/api/browser', options);

/**
 * 调用第三方 BrowserCrawler 服务的 ChromeRemote 端点 (`/api/chrome-remote`)。
 *
 * 指纹更接近真实浏览器，适合强反爬站点，但单次开销更高。作为 Headless 端点失败后
 * 的二级降级。
 *
 * @param options 爬取选项。
 * @returns 第三方服务响应。
 */
export const thirdPartyCrawlerForChromeRemote = (options: BrowserCrawlerOptions) => postCrawler('/api/chrome-remote', options);

const extractResult = (response: BrowserCrawlerResponse): string | null => {
    if ('result' in response) {
        return response.result;
    }
    return null;
};

/**
 * 顺序调用第三方 BrowserCrawler 两个端点的完整降级链：headless → chrome-remote。
 *
 * 两级都无法拿到合法内容时抛错，错误信息会附带每一级的失败原因（网络错误 /
 * 错误响应 / 拦截页）。调用方可据此排查目标站点状况。
 *
 * @param options 爬取选项。
 * @returns 第三方服务抓到的 HTML 字符串。
 * @throws 两级端点都失败时抛 Error。
 */
export const fetchHtmlByBrowserCrawler = async (options: BrowserCrawlerOptions): Promise<string> => {
    const failures: string[] = [];

    for (const [name, caller] of [
        ['browser', thirdPartyCrawlerForBrowser],
        ['chrome-remote', thirdPartyCrawlerForChromeRemote],
    ] as const) {
        try {
            logger.debug(`[browser-crawler] 调用第三方服务 (${name}) 抓取 ${options.url}`);
            const response = await caller(options);
            if ('error' in response) {
                failures.push(`${name}: ${response.error} - ${response.message}`);
                continue;
            }
            const result = extractResult(response);
            if (isValidContent(result)) {
                logger.debug(`[browser-crawler] 第三方服务 (${name}) 成功返回 ${options.url}`);
                return result;
            }
            failures.push(`${name}: 返回内容为空或被识别为反爬拦截页`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`${name}: ${message}`);
        }
    }

    throw new Error(`[browser-crawler] 第三方服务全部失败 (${options.url})：${failures.join('；')}`);
};

/**
 * HTML 抓取的统一 fallback 入口：先走普通 ofetch（不启用重试，缩短失败等待），失败或
 * 响应被识别为反爬拦截页时降级到第三方浏览器服务。
 *
 * 与 {@link getPageHtml} 的区别在于主路径使用普通 HTTP 请求（无 JS 渲染），适合响应已
 * 经是完整 HTML 的站点；若目标站点需要 JS 渲染，应优先使用 {@link getPageHtml}。
 *
 * 注意事项：
 * - 返回值恒为 HTML 字符串（`responseType: 'text'`），不会自动 JSON 解析；
 * - 本地 fetch 失败或空响应不会抛出，仅打 warn 日志后降级。两级都失败才抛错。
 *
 * @param url 目标 URL。
 * @param options 请求与降级选项。
 * @returns HTML 字符串。
 */
export const fetchHtmlWithFallback = async (
    url: string,
    options: {
        /** 请求头，透传给 ofetch。 */
        headers?: Record<string, string>;
        /** 查询参数。 */
        query?: Record<string, string | number | undefined>;
        /** 请求超时（毫秒），默认 30s。 */
        timeout?: number;
        /** 透传给第三方浏览器服务的附加选项。 */
        fallbackOptions?: Omit<BrowserCrawlerOptions, 'url'>;
    } = {}
): Promise<string> => {
    try {
        const html = await ofetch<string>(url, {
            headers: options.headers,
            query: options.query,
            timeout: options.timeout ?? 30_000,
            responseType: 'text',
            retry: 0,
        });
        if (isValidContent(html)) {
            return html;
        }
        logger.warn(`[fetchHtmlWithFallback] 本地 fetch 返回内容无效或疑似反爬拦截页，降级到第三方服务：${url}`);
    } catch (error) {
        logger.warn(`[fetchHtmlWithFallback] 本地 fetch 失败，降级到第三方服务：${url} - ${error instanceof Error ? error.message : String(error)}`);
    }

    return await fetchHtmlByBrowserCrawler({
        url,
        ...options.fallbackOptions,
    });
};
