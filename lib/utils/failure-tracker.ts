/**
 * 路由失败追踪工具。
 *
 * 设计要点：
 * - 所有失败记录存放在单个缓存 key（`rsshub:failed-routes`）下的 JSON Map 中，
 *   path 作为 map key。一次读、一次写完成所有维护，避免 N 次 IO；同时也是
 *   memory cache 唯一可行的列表化方案（globalCache 没有 keys 接口）。
 * - 每条记录内嵌 `expiresAt`，实现按记录的"滑动 60 分钟"过期：每次失败将
 *   `expiresAt` 重置为 `now + TTL`，读取/写入时统一 lazy 清理过期项。
 * - 容器 key 设置一个远大于单条 TTL 的总 TTL（24 小时），仅用于在长时间
 *   完全无活动时让缓存自然回收，不影响逐条过期语义。
 * - 写入路径全部 fire-and-forget：调用方只触发，不 await。错误处理流程
 *   不会因为追踪逻辑的 IO 抖动被阻塞。
 * - 同进程内通过 Promise 链对读改写串行化，避免并发覆盖。跨进程下的少量
 *   竞态可以接受，最差结果是单次失败/清除被覆盖。
 */

import cacheModule from '@/utils/cache/index';
import logger from '@/utils/logger';

const STORE_KEY = 'rsshub:failed-routes';
const FAILURE_TTL_MS = 60 * 60 * 1000;
const STORE_TTL_SECONDS = 24 * 60 * 60;
const MAX_RECORDS = 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** 敏感 query 参数名，匹配时小写。命中后值替换为 `***`。 */
const SENSITIVE_QUERY_KEYS = new Set(['key', 'code', 'access_key', 'accesskey', 'token', 'cookie', 'password', 'auth', 'authorization', 'secret']);

export interface FailureRecord {
    /** 经过敏感参数脱敏的请求路径（含 query string） */
    requestPath: string;
    /** Hono 匹配到的路由模板，例如 `/github/issue/:user/:repo`；未匹配时为 null */
    routePath: string | null;
    /** 该 path 在当前滑动窗口内累计失败次数 */
    count: number;
    /** 第一次失败时间（毫秒时间戳） */
    firstSeenAt: number;
    /** 最近一次失败时间（毫秒时间戳） */
    lastSeenAt: number;
    /** 过期时间戳（毫秒）；每次失败重置为 now + FAILURE_TTL_MS */
    expiresAt: number;
    /** 最近一次返回的 HTTP 状态码 */
    lastStatus: number;
    /** 最近一次错误的可读消息 */
    lastError: string;
    /** 最近一次错误的类名，例如 `HTTPError` `NotFoundError` */
    lastErrorName: string;
}

/**
 * 对请求路径中的敏感 query 参数脱敏，避免失败列表本身泄漏凭证。
 * @param rawPath 原始路径（含 query）。
 * @returns 脱敏后的路径，如无变化则原样返回。
 */
const sanitizePath = (rawPath: string): string => {
    const queryIdx = rawPath.indexOf('?');
    if (queryIdx === -1) {
        return rawPath;
    }
    const pathPart = rawPath.slice(0, queryIdx);
    const queryPart = rawPath.slice(queryIdx + 1);
    try {
        const params = new URLSearchParams(queryPart);
        const sensitiveKeys: string[] = [];
        for (const k of params.keys()) {
            if (SENSITIVE_QUERY_KEYS.has(k.toLowerCase())) {
                sensitiveKeys.push(k);
            }
        }
        if (sensitiveKeys.length === 0) {
            return rawPath;
        }
        for (const k of sensitiveKeys) {
            params.set(k, '***');
        }
        return `${pathPart}?${params.toString()}`;
    } catch {
        return rawPath;
    }
};

/**
 * 进程内串行化队列。任何一次读改写都通过该队列排队，保证同一进程内的
 * 顺序一致性，避免后写覆盖先写造成的丢失。
 */
let chain: Promise<unknown> = Promise.resolve();
const swallow = (): null => null;
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = chain.then(task, task);
    chain = next.catch(swallow);
    return next;
};

const readStore = async (): Promise<Record<string, FailureRecord>> => {
    if (!cacheModule.status.available) {
        return {};
    }
    try {
        const raw = await cacheModule.globalCache.get(STORE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, FailureRecord>) : {};
    } catch (error) {
        logger.error('failure-tracker: failed to read store: ' + (error as Error).message);
        return {};
    }
};

const writeStore = async (store: Record<string, FailureRecord>): Promise<void> => {
    if (!cacheModule.status.available) {
        return;
    }
    try {
        await cacheModule.globalCache.set(STORE_KEY, JSON.stringify(store), STORE_TTL_SECONDS);
    } catch (error) {
        logger.error('failure-tracker: failed to write store: ' + (error as Error).message);
    }
};

/**
 * 删除已过期的记录。返回是否发生变更，调用方据此决定是否需要写回。
 */
const pruneExpired = (store: Record<string, FailureRecord>, now: number): boolean => {
    let mutated = false;
    for (const key of Object.keys(store)) {
        if (store[key].expiresAt <= now) {
            delete store[key];
            mutated = true;
        }
    }
    return mutated;
};

/**
 * 当记录数超过上限时，按 lastSeenAt 升序裁剪掉最旧的一批。
 * 仅作为防御性兜底，正常流量下不会触发。
 */
const enforceCap = (store: Record<string, FailureRecord>): boolean => {
    const keys = Object.keys(store);
    if (keys.length <= MAX_RECORDS) {
        return false;
    }
    const sorted = keys.toSorted((a, b) => store[a].lastSeenAt - store[b].lastSeenAt);
    const drop = sorted.slice(0, keys.length - MAX_RECORDS);
    for (const k of drop) {
        delete store[k];
    }
    return true;
};

export interface RecordFailureInput {
    /** 完整请求路径（含 query），将被自动脱敏 */
    requestPath: string;
    /** Hono 匹配到的路由模板；未匹配传 null */
    routePath: string | null;
    /** 响应状态码 */
    status: number;
    /** 抛出的错误对象 */
    error: Error;
}

/**
 * 记录一次路由失败。fire-and-forget，调用方不需要 await，也不会抛出异常。
 * @param input 失败上下文。
 */
export const recordFailure = (input: RecordFailureInput): void => {
    void enqueue(async () => {
        if (!cacheModule.status.available) {
            return;
        }
        const now = Date.now();
        const sanitized = sanitizePath(input.requestPath);
        const store = await readStore();
        pruneExpired(store, now);
        const existing = store[sanitized];
        store[sanitized] = {
            requestPath: sanitized,
            routePath: input.routePath,
            count: (existing?.count ?? 0) + 1,
            firstSeenAt: existing?.firstSeenAt ?? now,
            lastSeenAt: now,
            expiresAt: now + FAILURE_TTL_MS,
            lastStatus: input.status,
            lastError: input.error.message ?? String(input.error),
            lastErrorName: input.error.name ?? 'Error',
        };
        enforceCap(store);
        await writeStore(store);
    });
};

/**
 * 当某个 path 重新成功响应时清除其失败记录。fire-and-forget。
 * @param requestPath 原始请求路径（含 query），将被自动脱敏后匹配。
 */
export const clearFailure = (requestPath: string): void => {
    void enqueue(async () => {
        if (!cacheModule.status.available) {
            return;
        }
        const sanitized = sanitizePath(requestPath);
        const store = await readStore();
        const had = sanitized in store;
        if (had) {
            delete store[sanitized];
        }
        const prunedAny = pruneExpired(store, Date.now());
        if (had || prunedAny) {
            await writeStore(store);
        }
    });
};

export interface ListFailuresOptions {
    limit?: number;
    offset?: number;
}

export interface ListFailuresResult {
    /** 当前窗口内尚未过期的失败 path 总数 */
    total: number;
    /** 按最近失败时间倒序的分页结果 */
    items: FailureRecord[];
    /** 数据生成时刻（毫秒时间戳），便于客户端理解 expiresAt 的相对位置 */
    generatedAt: number;
}

/**
 * 拉取失败列表。读取时同步 lazy 清理已过期项，仅在确实有变更时回写。
 * @param options 分页参数；limit 上限 500，默认 100。
 * @returns 总数与按 lastSeenAt 倒序的分页结果。
 */
export const listFailures = (options: ListFailuresOptions = {}): Promise<ListFailuresResult> =>
    enqueue(async () => {
        const now = Date.now();
        const store = await readStore();
        if (pruneExpired(store, now)) {
            await writeStore(store);
        }
        const all = Object.values(store).toSorted((a, b) => b.lastSeenAt - a.lastSeenAt);
        const offset = Math.max(0, options.offset ?? 0);
        const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
        return {
            total: all.length,
            items: all.slice(offset, offset + limit),
            generatedAt: now,
        };
    });

/**
 * 仅供测试使用，清空进程内串行化链。生产代码不应调用。
 */
export const __resetForTests = (): void => {
    chain = Promise.resolve();
};
