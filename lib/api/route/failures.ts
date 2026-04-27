import type { RouteHandler } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';

import { listFailures } from '@/utils/failure-tracker';

const QuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .openapi({
            param: { name: 'limit', in: 'query' },
            example: 100,
            description: 'Page size, default 100, max 500.',
        }),
    offset: z.coerce
        .number()
        .int()
        .min(0)
        .optional()
        .openapi({
            param: { name: 'offset', in: 'query' },
            example: 0,
            description: 'Page offset, default 0.',
        }),
});

const ItemSchema = z.object({
    requestPath: z.string(),
    routePath: z.string().nullable(),
    count: z.number(),
    firstSeenAt: z.number(),
    lastSeenAt: z.number(),
    expiresAt: z.number(),
    lastStatus: z.number(),
    lastError: z.string(),
    lastErrorName: z.string(),
});

const ResponseSchema = z.object({
    total: z.number(),
    items: z.array(ItemSchema),
    generatedAt: z.number(),
});

const route = createRoute({
    method: 'get',
    path: '/route/failures',
    description:
        'List request paths that recently failed within the rolling 60 minute window. ' +
        'Includes 4xx (e.g. 404 for invalid routes) and 5xx failures. ' +
        'Each record refreshes its expiration on every new failure, and is removed when the path next responds successfully.',
    tags: ['Route'],
    request: {
        query: QuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: ResponseSchema,
                },
            },
            description: 'Sorted by last seen time, newest first',
        },
    },
});

const handler: RouteHandler<typeof route> = async (ctx) => {
    const { limit, offset } = ctx.req.valid('query');
    const result = await listFailures({ limit, offset });
    return ctx.json(result);
};

export { handler, route };
