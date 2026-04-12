module.exports = {
    schemas: {
        PlatformStoreResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                platform: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'], example: 'shopee' },
                store_name: { type: 'string', example: 'My Shopee Store' },
                external_store_id: { type: 'string', example: '123456789' },
                external_store_name: { type: 'string', nullable: true, example: 'My Shop' },
                region: { type: 'string', nullable: true, example: 'MY' },
                token_expires_at: { type: 'string', format: 'date-time', nullable: true },
                default_warehouse_id: { type: 'integer', nullable: true, example: 1 },
                is_active: { type: 'boolean', example: true },
                defaultWarehouse: {
                    type: 'object', nullable: true,
                    properties: { id: { type: 'integer' }, name: { type: 'string' }, code: { type: 'string' } },
                },
                created_at: { type: 'string', format: 'date-time' },
            },
        },
    },
    paths: {
        '/platform-stores': {
            get: {
                tags: ['Platform Stores'], summary: 'List connected platform stores',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platform', schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada', 'all'] } },
                    { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                ],
                responses: { 200: { description: 'Platform stores list (tokens excluded)' } },
            },
            post: {
                tags: ['Platform Stores'], summary: 'Connect a platform store',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', required: ['platform', 'storeName', 'externalStoreId'], properties: {
                                    platform: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] },
                                    storeName: { type: 'string', example: 'My Shopee Store' },
                                    externalStoreId: { type: 'string', example: '123456789' },
                                    externalStoreName: { type: 'string', example: 'My Shop' },
                                    region: { type: 'string', example: 'MY' },
                                    defaultWarehouseId: { type: 'integer', example: 1 },
                                    webhookSecret: { type: 'string', description: 'Secret for webhook signature verification' },
                                }
                            }
                        }
                    },
                },
                responses: { 201: { description: 'Store connected' }, 409: { description: 'Already connected' } },
            },
        },
        '/platform-stores/{id}': {
            get: { tags: ['Platform Stores'], summary: 'Get store by ID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
            put: { tags: ['Platform Stores'], summary: 'Update store settings', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { storeName: { type: 'string' }, isActive: { type: 'boolean' }, defaultWarehouseId: { type: 'integer' } } } } } }, responses: { 200: { description: 'Updated' } } },
            delete: { tags: ['Platform Stores'], summary: 'Disconnect store (soft delete)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Disconnected' }, 400: { description: 'Active mappings exist' } } },
        },
        '/platform-stores/{id}/tokens': {
            put: {
                tags: ['Platform Stores'], summary: 'Update OAuth tokens — called by Java after token refresh',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true, content: {
                        'application/json': {
                            schema: {
                                type: 'object', properties: {
                                    accessToken: { type: 'string' },
                                    refreshToken: { type: 'string' },
                                    tokenExpiresAt: { type: 'string', format: 'date-time' },
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Tokens updated' } },
            },
        },
    },
};