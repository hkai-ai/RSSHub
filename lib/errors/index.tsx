import * as Sentry from '@sentry/node';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { routePath } from 'hono/route';

import { config } from '@/config';
import { getDebugInfo, setDebugInfo } from '@/utils/debug-info';
import { recordFailure } from '@/utils/failure-tracker';
import logger from '@/utils/logger';
import { requestMetric } from '@/utils/otel';
import Error from '@/views/error';

import NotFoundError from './types/not-found';

const UNTRACKED_PATHS = new Set(['/', '/robots.txt', '/logo.png', '/favicon.ico', '/healthz', '/metrics']);

export const errorHandler: ErrorHandler = (error, ctx) => {
    const requestPath = ctx.req.path;
    const matchedRoute = routePath(ctx);
    const hasMatchedRoute = matchedRoute !== '/*';

    const debug = getDebugInfo();
    try {
        if (ctx.res.headers.get('RSSHub-Cache-Status')) {
            debug.hitCache++;
        }
    } catch {
        // ignore
    }
    debug.error++;

    if (!debug.errorPaths[requestPath]) {
        debug.errorPaths[requestPath] = 0;
    }
    debug.errorPaths[requestPath]++;

    if (!debug.errorRoutes[matchedRoute] && hasMatchedRoute) {
        debug.errorRoutes[matchedRoute] = 0;
    }
    hasMatchedRoute && debug.errorRoutes[matchedRoute]++;
    setDebugInfo(debug);

    if (config.sentry.dsn) {
        Sentry.withScope((scope) => {
            scope.setTag('name', requestPath.split('/')[1]);
            Sentry.captureException(error);
        });
    }

    let errorMessage = (process.env.NODE_ENV || process.env.VERCEL_ENV) === 'production' ? error.message : error.stack || error.message;
    switch (error.constructor.name) {
        case 'HTTPError':
        case 'RequestError':
        case 'FetchError':
            ctx.status(503);
            break;
        case 'RequestInProgressError':
            ctx.header('Cache-Control', `public, max-age=${config.requestTimeout / 1000}`);
            ctx.status(503);
            break;
        case 'RejectError':
            ctx.status(403);
            break;
        case 'NotFoundError':
            ctx.status(404);
            errorMessage += 'The route does not exist or has been deleted.';
            break;
        default:
            ctx.status(503);
            break;
    }
    const message = `${error.name}: ${errorMessage}`;

    logger.error(`Error in ${requestPath}: ${message}`);
    requestMetric.error({ path: matchedRoute, method: ctx.req.method, status: ctx.res.status });

    /**
     * 记录路由失败到追踪器：
     * - 跳过 RequestInProgressError：它是缓存竞态保护，不代表上游真正失败。
     * - 跳过非路由请求（首页、静态资源、内部 API、健康检查、metrics）。
     * - 包含 404：用户错路径也是值得提醒的失败信号。
     * 整段 try/catch，追踪自身任何异常都不能影响错误响应主流程。
     */
    if (error.constructor.name !== 'RequestInProgressError' && !UNTRACKED_PATHS.has(requestPath) && !requestPath.startsWith('/api/')) {
        try {
            const url = ctx.req.url ?? '';
            const qIdx = url.indexOf('?');
            const fullPath = qIdx !== -1 ? requestPath + url.slice(qIdx) : requestPath;
            recordFailure({
                requestPath: fullPath,
                routePath: hasMatchedRoute ? matchedRoute : null,
                status: ctx.res.status,
                error,
            });
        } catch {
            // 静默忽略：失败追踪绝不能影响错误处理主流程
        }
    }

    return config.isPackage || ctx.req.query('format') === 'json'
        ? ctx.json({
              error: {
                  message: error.message ?? error,
              },
          })
        : ctx.html(<Error requestPath={requestPath} message={message} errorRoute={hasMatchedRoute ? matchedRoute : requestPath} nodeVersion={process.version} />);
};

export const notFoundHandler: NotFoundHandler = (ctx) => errorHandler(new NotFoundError(), ctx);
