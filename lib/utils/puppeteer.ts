import { anonymizeProxy } from 'proxy-chain';
import type { Browser, Page } from 'rebrowser-puppeteer';
import puppeteer from 'rebrowser-puppeteer';

import { config } from '@/config';

import { type BrowserCrawlerOptions, fetchHtmlByBrowserCrawler, isValidContent } from './browser-crawler';
import logger from './logger';
import proxy from './proxy';

/**
 * @deprecated use getPage instead
 * @returns Puppeteer browser
 */
const outPuppeteer = async () => {
    const options = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            `--user-agent=${config.ua}`,
        ],
        headless: true,
        ignoreHTTPSErrors: true,
    };

    const insidePuppeteer: typeof puppeteer = puppeteer;

    const currentProxy = proxy.getCurrentProxy();
    if (currentProxy && proxy.proxyObj.url_regex === '.*') {
        if (currentProxy.urlHandler?.username || currentProxy.urlHandler?.password) {
            // only proxies with authentication need to be anonymized
            if (currentProxy.urlHandler.protocol === 'http:') {
                options.args.push(`--proxy-server=${await anonymizeProxy(currentProxy.uri)}`);
            } else {
                logger.warn('SOCKS/HTTPS proxy with authentication is not supported by puppeteer, continue without proxy');
            }
        } else {
            // Chromium cannot recognize socks5h and socks4a, so we need to trim their postfixes
            options.args.push(`--proxy-server=${currentProxy.uri.replace('socks5h://', 'socks5://').replace('socks4a://', 'socks4://')}`);
        }
    }
    const browser = await (config.puppeteerWSEndpoint
        ? insidePuppeteer.connect({
              browserWSEndpoint: config.puppeteerWSEndpoint,
          })
        : insidePuppeteer.launch(
              config.chromiumExecutablePath
                  ? {
                        executablePath: config.chromiumExecutablePath,
                        ...options,
                    }
                  : options
          ));
    setTimeout(async () => {
        await browser.close();
    }, 30000);

    return browser;
};

export default outPuppeteer;

// No-op in Node.js environment (used by Worker build via alias)

export const setBrowserBinding = (_binding: any) => {};

/**
 * @returns Puppeteer page
 */
export const getPuppeteerPage = async (
    url: string,
    instanceOptions: {
        onBeforeLoad?: (page: Page, browser?: Browser) => Promise<void> | void;
        gotoConfig?: {
            waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
        };
        noGoto?: boolean;
    } = {}
) => {
    const options = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            `--user-agent=${config.ua}`,
        ],
        headless: true,
        ignoreHTTPSErrors: true,
    };

    const insidePuppeteer: typeof puppeteer = puppeteer;

    let allowProxy = false;
    const proxyRegex = new RegExp(proxy.proxyObj.url_regex);
    let urlHandler;
    try {
        urlHandler = new URL(url);
    } catch {
        // ignore
    }

    if (proxyRegex.test(url) && url.startsWith('http') && !(urlHandler && urlHandler.host === proxy.proxyUrlHandler?.host)) {
        allowProxy = true;
    }

    let hasProxy = false;
    let currentProxyState: any = null;
    const currentProxy = proxy.getCurrentProxy();
    if (currentProxy && allowProxy) {
        currentProxyState = currentProxy;
        if (currentProxy.urlHandler?.username || currentProxy.urlHandler?.password) {
            // only proxies with authentication need to be anonymized
            if (currentProxy.urlHandler.protocol === 'http:') {
                const urlObj = new URL(currentProxy.uri);
                urlObj.username = '';
                urlObj.password = '';
                options.args.push(`--proxy-server=${urlObj.toString().replace(/\/$/, '')}`);
                hasProxy = true;
            } else {
                logger.warn('SOCKS/HTTPS proxy with authentication is not supported by puppeteer, continue without proxy');
            }
        } else {
            // Chromium cannot recognize socks5h and socks4a, so we need to trim their postfixes
            options.args.push(`--proxy-server=${currentProxy.uri.replace('socks5h://', 'socks5://').replace('socks4a://', 'socks4://')}`);
            hasProxy = true;
        }
    }
    let browser: Browser;
    if (config.puppeteerWSEndpoint) {
        const endpointURL = new URL(config.puppeteerWSEndpoint);
        endpointURL.searchParams.set('launch', JSON.stringify(options));
        endpointURL.searchParams.set('stealth', 'true');
        const endpoint = endpointURL.toString();
        browser = await insidePuppeteer.connect({
            browserWSEndpoint: endpoint,
        });
    } else {
        browser = await insidePuppeteer.launch(
            config.chromiumExecutablePath
                ? {
                      executablePath: config.chromiumExecutablePath,
                      ...options,
                  }
                : options
        );
    }

    setTimeout(async () => {
        await browser.close();
    }, 30000);

    const page = await browser.newPage();

    if (hasProxy && currentProxyState) {
        logger.debug(`Proxying request in puppeteer via ${currentProxyState.uri}: ${url}`);
    }

    if (hasProxy && currentProxyState && (currentProxyState.urlHandler?.username || currentProxyState.urlHandler?.password)) {
        await page.authenticate({
            username: currentProxyState.urlHandler?.username,
            password: currentProxyState.urlHandler?.password,
        });
    }

    if (instanceOptions.onBeforeLoad) {
        await instanceOptions.onBeforeLoad(page, browser);
    }

    if (!instanceOptions.noGoto) {
        try {
            await page.goto(url, instanceOptions.gotoConfig || { waitUntil: 'domcontentloaded' });
        } catch (error) {
            if (hasProxy && currentProxyState && proxy.multiProxy) {
                logger.warn(`Puppeteer navigation failed with proxy ${currentProxyState.uri}, marking as failed: ${error}`);
                proxy.markProxyFailed(currentProxyState.uri);
                throw error;
            }
            throw error;
        }
    }

    return {
        page,
        destory: async () => {
            await browser.close();
        },
        browser,
    };
};

/**
 * 仅消费 HTML 的场景下，统一的「本地 puppeteer → 第三方 BrowserCrawler」降级入口。
 *
 * 执行顺序：
 *   1. 本地 puppeteer（复用 {@link getPuppeteerPage}）；
 *   2. 第三方服务 headless 端点；
 *   3. 第三方服务 chrome-remote 端点。
 *
 * 任一步骤拿到「有效内容」（非空、非 Cloudflare / DataDome 拦截页）即返回；本地步骤
 * 抛错或内容无效时静默降级。全部失败时抛出最后一次真实错误。
 *
 * 需要 Page 交互（`page.evaluate` / `newPage` / 请求拦截等）的 route 请继续使用
 * {@link getPuppeteerPage}；此函数仅用于「拿到 HTML 后交给 cheerio」的场景。
 *
 * @param url 目标页面 URL。
 * @param options 本地 puppeteer 与第三方服务共享的选项；`fallbackOptions` 仅透传给
 *   第三方服务（如 `validationRule`、`isBanResourceRequest` 等）。
 * @returns 抓到的 HTML 字符串。
 * @throws 本地 puppeteer 与第三方服务全部失败时抛 Error。
 */
export const getPageHtml = async (
    url: string,
    options: {
        /** 传入本地 puppeteer 的 onBeforeLoad 钩子。 */
        onBeforeLoad?: (page: Page, browser?: Browser) => Promise<void> | void;
        /** 本地 puppeteer goto 的 waitUntil 配置。 */
        gotoConfig?: {
            waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
        };
        /**
         * 本地 puppeteer 拿到 HTML 之前可执行的自定义动作（如 `waitForSelector`）。
         * 返回 HTML 字符串则直接使用；返回 void 则由 helper 调用 `page.content()`。
         */
        prepare?: (page: Page, browser: Browser) => Promise<string | void>;
        /** 传给第三方 BrowserCrawler 的附加选项。 */
        fallbackOptions?: Omit<BrowserCrawlerOptions, 'url'>;
    } = {}
): Promise<string> => {
    try {
        const { page, destory, browser } = await getPuppeteerPage(url, {
            onBeforeLoad: options.onBeforeLoad,
            gotoConfig: options.gotoConfig,
        });
        try {
            const prepared = options.prepare ? await options.prepare(page, browser) : undefined;
            const html = prepared ?? (await page.content());
            if (isValidContent(html)) {
                return html;
            }
            logger.warn(`[getPageHtml] 本地 puppeteer 返回内容无效或疑似反爬拦截页，降级到第三方服务：${url}`);
        } finally {
            await destory();
        }
    } catch (error) {
        logger.warn(`[getPageHtml] 本地 puppeteer 抓取失败，降级到第三方服务：${url} - ${error instanceof Error ? error.message : String(error)}`);
    }

    return await fetchHtmlByBrowserCrawler({
        url,
        ...options.fallbackOptions,
    });
};
