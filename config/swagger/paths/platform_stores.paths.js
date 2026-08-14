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
                store_shop_id: { type: 'string', nullable: true, example: '7890123456' },
                store_open_id: { type: 'string', nullable: true, example: 'OPEN_ID_ABC123' },
                store_cipher: { type: 'string', nullable: true, example: 'cipher_xyz' },
                region: { type: 'string', nullable: true, example: 'MY' },
                token_expires_at: { type: 'string', format: 'date-time', nullable: true },
                default_warehouse_id: { type: 'integer', nullable: true, example: 1 },
                is_active: { type: 'boolean', example: true },
                auto_order_accept: {
                    type: 'boolean',
                    example: false,
                    description: 'Whether Auto Order Accept is enabled for this store.',
                },
                auto_order_accept_days: {
                    type: 'string',
                    example: '0,1,2,3,4,5,6',
                    description: 'Comma-separated weekdays when Auto Order Accept can run. 0=Sunday, 6=Saturday.',
                },
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
                                type: 'object',
                                required: ['platform', 'storeName', 'externalStoreId'],
                                properties: {
                                    platform: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] },
                                    storeName: { type: 'string', example: 'My Shopee Store' },
                                    externalStoreId: { type: 'string', example: '123456789' },
                                    externalStoreName: { type: 'string', example: 'My Shop' },
                                    storeShopId: { type: 'string', example: '7890123456', description: 'Optional platform shop ID (e.g. TikTok shop_id)' },
                                    storeOpenId: { type: 'string', example: 'OPEN_ID_ABC123', description: 'Optional platform open/seller ID (e.g. TikTok open_id)' },
                                    storeCipher: { type: 'string', example: 'cipher_xyz', description: 'Optional platform cipher / encrypted store token' },
                                    region: { type: 'string', example: 'MY' },
                                    defaultWarehouseId: { type: 'integer', example: 1 },
                                    autoOrderAccept: { type: 'boolean', example: false, description: 'Optional Auto Order Accept setting. Defaults to false.' },
                                    autoOrderAcceptDays: {
                                        type: 'array',
                                        items: { type: 'integer', minimum: 0, maximum: 6 },
                                        example: [0, 1, 2, 3, 4, 5, 6],
                                        description: 'Weekdays when Auto Order Accept can run. 0=Sunday, 6=Saturday.',
                                    },
                                    webhookSecret: { type: 'string', description: 'Secret for webhook signature verification' },
                                },
                            },
                        },
                    },
                },
                responses: { 201: { description: 'Store connected' }, 409: { description: 'Already connected' } },
            },
        },
        '/platform-stores/by-shop-id': {
            get: {
                tags: ['Platform Stores'],
                summary: 'Get one store by platform and store shop ID',
                description: 'Returns one platform store for the current company using platform and store_shop_id. Tokens and webhook secret are excluded.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platform', required: true, schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] }, example: 'shopee' },
                    { in: 'query', name: 'storeShopId', required: true, schema: { type: 'string' }, example: '123456' },
                ],
                responses: {
                    200: {
                        description: 'Platform store fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Platform store fetched successfully' },
                                        data: { $ref: '#/components/schemas/PlatformStoreResponse' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Platform store not found' },
                },
            },
        },
        '/platform-stores/public': {
            post: {
                tags: ['Platform Stores'],
                summary: 'Public connect a platform store',
                description: 'Creates a platform store without Bearer token/JWT. companyId is required because there is no authenticated user context. Tokens and webhook secret are excluded from the response.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['companyId', 'platform', 'storeName', 'externalStoreId'],
                                properties: {
                                    companyId: { type: 'integer', example: 1 },
                                    platform: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'], example: 'shopee' },
                                    storeName: { type: 'string', example: 'My Shopee Store' },
                                    externalStoreId: { type: 'string', example: '123456789' },
                                    externalStoreName: { type: 'string', example: 'My Shop' },
                                    storeShopId: { type: 'string', example: '7890123456', description: 'Optional platform shop ID (e.g. TikTok shop_id)' },
                                    storeOpenId: { type: 'string', example: 'OPEN_ID_ABC123', description: 'Optional platform open/seller ID (e.g. TikTok open_id)' },
                                    storeCipher: { type: 'string', example: 'cipher_xyz', description: 'Optional platform cipher / encrypted store token' },
                                    region: { type: 'string', example: 'MY' },
                                    defaultWarehouseId: { type: 'integer', example: 1 },
                                    autoOrderAccept: { type: 'boolean', example: false, description: 'Optional Auto Order Accept setting. Defaults to false.' },
                                    autoOrderAcceptDays: {
                                        type: 'array',
                                        items: { type: 'integer', minimum: 0, maximum: 6 },
                                        example: [0, 1, 2, 3, 4, 5, 6],
                                        description: 'Weekdays when Auto Order Accept can run. 0=Sunday, 6=Saturday.',
                                    },
                                    webhookSecret: { type: 'string', description: 'Secret for webhook signature verification' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Store connected',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Platform store connected successfully' },
                                        data: { $ref: '#/components/schemas/PlatformStoreResponse' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    404: { description: 'Company not found' },
                    409: { description: 'Already connected' },
                },
            },
        },
        '/platform-stores/public/by-shop-id': {
            get: {
                tags: ['Platform Stores'],
                summary: 'Public get one store by platform and store shop ID',
                description: 'Returns one platform store using platform and store_shop_id without Bearer token/JWT. Tokens and webhook secret are excluded.',
                security: [],
                parameters: [
                    { in: 'query', name: 'platform', required: true, schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] }, example: 'shopee' },
                    { in: 'query', name: 'storeShopId', required: true, schema: { type: 'string' }, example: '123456' },
                ],
                responses: {
                    200: {
                        description: 'Platform store fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Platform store fetched successfully' },
                                        data: { $ref: '#/components/schemas/PlatformStoreResponse' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    404: { description: 'Platform store not found' },
                },
            },
        },
        '/platform-stores/{id}': {
            get: {
                tags: ['Platform Stores'], summary: 'Get store by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'OK' } },
            },
            put: {
                tags: ['Platform Stores'], summary: 'Update store settings',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    storeName: { type: 'string' },
                                    externalStoreName: { type: 'string' },
                                    storeShopId: { type: 'string', description: 'Optional platform shop ID' },
                                    storeOpenId: { type: 'string', description: 'Optional platform open/seller ID' },
                                    storeCipher: { type: 'string', description: 'Optional platform cipher' },
                                    region: { type: 'string' },
                                    isActive: { type: 'boolean' },
                                    autoOrderAccept: {
                                        type: 'boolean',
                                        description: 'Turn Auto Order Accept on or off for this store.',
                                    },
                                    autoOrderAcceptDays: {
                                        type: 'array',
                                        items: { type: 'integer', minimum: 0, maximum: 6 },
                                        example: [0, 1, 2, 3, 4, 5],
                                        description: 'Weekdays when Auto Order Accept can run. 0=Sunday, 6=Saturday.',
                                    },
                                    defaultWarehouseId: { type: 'integer' },
                                    webhookSecret: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Updated' } },
            },
            delete: {
                tags: ['Platform Stores'], summary: 'Disconnect store (soft delete)',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Disconnected' }, 400: { description: 'Active mappings exist' } },
            },
        },
        '/platform-stores/{id}/tokens': {
            put: {
                tags: ['Platform Stores'], summary: 'Update OAuth tokens — called by Java after token refresh',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    accessToken: { type: 'string' },
                                    refreshToken: { type: 'string' },
                                    tokenExpiresAt: { type: 'string', format: 'date-time' },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Tokens updated' } },
            },
        },
    },
};
