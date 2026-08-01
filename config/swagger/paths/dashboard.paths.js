module.exports = {
    schemas: {
        DashboardSummary: {
            type: 'object',
            properties: {
                totalProducts: { type: 'integer', example: 37 },
                todayOrders: { type: 'integer', example: 1 },
                totalStockUnits: { type: 'integer', example: 1200 },
                lowStock: { type: 'integer', example: 5 },
                outOfStock: { type: 'integer', example: 114 },
                platforms: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['shopee', 'tiktok'],
                },
            },
        },
    },

    paths: {
        '/dashboard/summary': {
            get: {
                tags: ['Dashboard'],
                summary: 'Get dashboard summary',
                description: 'Returns KPI counts for the dashboard overview cards, including today\'s order count.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Dashboard summary fetched',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Dashboard summary fetched' },
                                        data: { $ref: '#/components/schemas/DashboardSummary' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    500: { description: 'Internal server error' },
                },
            },
        },
    },
};
