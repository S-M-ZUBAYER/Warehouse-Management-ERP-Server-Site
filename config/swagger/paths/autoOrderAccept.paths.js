module.exports = {
    schemas: {
        AutoOrderAcceptRunResult: {
            type: 'object',
            properties: {
                source: { type: 'string', example: 'api' },
                startedAt: { type: 'string', format: 'date-time' },
                finishedAt: { type: 'string', format: 'date-time' },
                storesChecked: { type: 'integer', example: 2 },
                totals: {
                    type: 'object',
                    properties: {
                        checked: { type: 'integer', example: 5 },
                        packed: { type: 'integer', example: 4 },
                        failed: { type: 'integer', example: 1 },
                        skipped: { type: 'integer', example: 0 },
                    },
                },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            storeId: { type: 'integer', example: 1 },
                            storeName: { type: 'string', example: 'Grozziieprinter' },
                            platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'shopee' },
                            dayAllowed: { type: 'boolean', example: true },
                            checked: { type: 'integer', example: 3 },
                            packed: { type: 'integer', example: 3 },
                            failed: { type: 'integer', example: 0 },
                            skipped: { type: 'integer', example: 0 },
                            successfulIds: { type: 'array', items: { type: 'string' } },
                            failedOrders: { type: 'array', items: { type: 'object' } },
                            skippedOrders: { type: 'array', items: { type: 'object' } },
                        },
                    },
                },
            },
        },
    },
    paths: {
        '/auto-order-accept/run-now': {
            post: {
                tags: ['Auto Order Accept'],
                summary: 'Run Auto Order Accept now',
                description: 'Processes enabled stores immediately for eligible To Pack orders. This uses the same platform pack/ship endpoints as the frontend Pack action and does not deduct ERP inventory.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    platform: {
                                        type: 'string',
                                        enum: ['all', 'shopee', 'tiktok'],
                                        example: 'shopee',
                                    },
                                    storeId: {
                                        oneOf: [{ type: 'integer' }, { type: 'string', enum: ['all'] }],
                                        example: 1,
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Auto Order Accept run completed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Auto Order Accept run completed' },
                                        data: { $ref: '#/components/schemas/AutoOrderAcceptRunResult' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
    },
};
