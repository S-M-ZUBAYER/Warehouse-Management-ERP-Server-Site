module.exports = {
    schemas: {
        WithdrawOrder: {
            type: 'object',
            properties: {
                companyId: { type: 'string', example: 'company_id' },
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'shopee' },
                storeId: { type: 'string', example: 'store_id' },
                orderId: { type: 'string', example: 'ORDER123' },
                createdAt: { type: 'string', format: 'date-time', example: '2026-05-20T10:00:00.000Z' },
            },
        },
        WithdrawOrdersUpsertRequest: {
            type: 'object',
            required: ['platform', 'storeId', 'orders'],
            properties: {
                companyId: { type: 'string', example: 'company_id', description: 'Optional when JWT contains companyId; token companyId is used first.' },
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'tiktok' },
                storeId: { type: 'string', example: 'store_id' },
                orders: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['orderId'],
                        properties: {
                            orderId: { type: 'string', example: 'ORDER123' },
                        },
                    },
                },
            },
        },
        WithdrawOrdersDeleteRequest: {
            type: 'object',
            required: ['platform', 'storeId', 'orderIds'],
            properties: {
                companyId: { type: 'string', example: 'company_id', description: 'Optional when JWT contains companyId; token companyId is used first.' },
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'shopee' },
                storeId: { type: 'string', example: 'store_id' },
                orderIds: { type: 'array', items: { type: 'string' }, example: ['ORDER123'] },
            },
        },
    },
    paths: {
        '/order-management/withdraw-orders': {
            get: {
                tags: ['Order Management'],
                summary: 'List withdraw orders',
                description: 'Returns withdraw orders for the authenticated company, platform, and store. Rows older than 7 days are cleaned up before reading.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'companyId', schema: { type: 'string' }, description: 'Optional when JWT contains companyId; token companyId is used first.' },
                    { in: 'query', name: 'platform', required: true, schema: { type: 'string', enum: ['shopee', 'tiktok'] } },
                    { in: 'query', name: 'storeId', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Withdraw orders',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        data: { type: 'array', items: { $ref: '#/components/schemas/WithdrawOrder' } },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                },
            },
            post: {
                tags: ['Order Management'],
                summary: 'Save withdraw orders',
                description: 'Upserts by companyId + platform + storeId + orderId. Duplicate rows update updatedAt only. Rows older than 7 days are cleaned up first.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/WithdrawOrdersUpsertRequest' } } },
                },
                responses: {
                    201: {
                        description: 'Withdraw orders saved',
                        content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'boolean', example: true }, data: { type: 'object', properties: { count: { type: 'integer', example: 1 } } } } } } },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                },
            },
            delete: {
                tags: ['Order Management'],
                summary: 'Delete withdraw orders',
                description: 'Deletes only matching rows for the authenticated company, platform, storeId, and supplied order IDs.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/WithdrawOrdersDeleteRequest' } } },
                },
                responses: {
                    200: {
                        description: 'Withdraw orders deleted',
                        content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'boolean', example: true }, data: { type: 'object', properties: { deleted: { type: 'integer', example: 1 } } } } } } },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
    },
};
