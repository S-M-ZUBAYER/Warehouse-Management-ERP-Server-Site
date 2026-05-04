module.exports = {
    schemas: {
        PlatformProductResponse: {
            type: 'object',
            properties: {
                id:                    { type: 'integer', example: 1 },
                company_id:            { type: 'integer', example: 1 },
                platform_store_id:     { type: 'integer', example: 2 },
                platform:              { type: 'string', enum: ['shopee', 'tiktok', 'lazada'], example: 'shopee' },
                platform_product_id:   { type: 'string', example: '987654321' },
                platform_sku_id:       { type: 'string', nullable: true, example: '111222333' },
                platform_model_id:     { type: 'string', nullable: true, example: '111222333' },
                platform_location_id:  { type: 'string', nullable: true, example: 'LOC_001' },
                platform_warehouse_id: { type: 'string', nullable: true, example: 'WH_001' },
                product_name:          { type: 'string', example: 'Blue T-Shirt' },
                variation_name:        { type: 'string', nullable: true, example: 'Size M / Blue' },
                parent_sku:            { type: 'string', nullable: true, example: 'TSHIRT-BLUE' },
                seller_sku:            { type: 'string', nullable: true, example: 'TSHIRT-BLUE-M' },
                image_url:             { type: 'string', nullable: true, example: 'https://cdn.example.com/img.jpg' },
                store_name:            { type: 'string', example: 'My Shopee Store' },
                platform_stock:        { type: 'integer', example: 50 },
                platform_price:        { type: 'number', nullable: true, example: 29.99 },
                currency:              { type: 'string', nullable: true, example: 'MYR' },
                row_type:              { type: 'string', enum: ['parent', 'child'], example: 'child' },
                is_mapped:             { type: 'integer', enum: [0, 1], example: 0 },
                synced_at:             { type: 'string', format: 'date-time' },
            },
        },

        PlatformProductCounts: {
            type: 'object',
            properties: {
                all:      { type: 'integer', example: 120 },
                mapped:   { type: 'integer', example: 80 },
                unmapped: { type: 'integer', example: 40 },
            },
        },

        GenerateSkuResult: {
            type: 'object',
            properties: {
                created: { type: 'integer', example: 3 },
                message: { type: 'string', example: '3 Merchant SKU(s) generated successfully' },
                skus: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            merchantSkuId: { type: 'integer', example: 5 },
                            skuName:       { type: 'string', example: 'TSHIRT-BLUE-M' },
                            wasCreated:    { type: 'boolean', example: true },
                        },
                    },
                },
            },
        },

        AutoMappingResult: {
            type: 'object',
            properties: {
                matched: { type: 'integer', example: 10 },
                skipped: { type: 'integer', example: 2 },
                total:   { type: 'integer', example: 12 },
                message: { type: 'string', example: 'Auto mapping complete — 10 matched, 2 skipped' },
            },
        },
    },

    paths: {
        '/platform-products': {
            get: {
                tags:     ['Platform Products'],
                summary:  'List platform products (ByProduct page)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platformStoreId', schema: { type: 'integer' }, description: 'Filter by store' },
                    { in: 'query', name: 'platform',        schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] } },
                    { in: 'query', name: 'mappingStatus',   schema: { type: 'string', enum: ['all', 'mapped', 'unmapped'] }, description: 'Tab filter' },
                    { in: 'query', name: 'skuType',         schema: { type: 'string', enum: ['product_name', 'seller_sku', 'platform_product_id', 'platform_sku_id'] } },
                    { in: 'query', name: 'search',          schema: { type: 'string' } },
                    { in: 'query', name: 'rowType',         schema: { type: 'string', enum: ['parent', 'child'] } },
                    { in: 'query', name: 'page',            schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit',           schema: { type: 'integer', default: 20 } },
                ],
                responses: {
                    200: {
                        description: 'Paginated platform product list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success:    { type: 'boolean', example: true },
                                        message:    { type: 'string', example: 'Platform products fetched' },
                                        data:       { type: 'array', items: { $ref: '#/components/schemas/PlatformProductResponse' } },
                                        pagination: { $ref: '#/components/schemas/Pagination' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },

        '/platform-products/counts': {
            get: {
                tags:     ['Platform Products'],
                summary:  'Get tab badge counts (all / mapped / unmapped)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platformStoreId', schema: { type: 'integer' } },
                    { in: 'query', name: 'platform',        schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] } },
                ],
                responses: {
                    200: {
                        description: 'Counts object',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        data:    { $ref: '#/components/schemas/PlatformProductCounts' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },

        '/platform-products/sync': {
            post: {
                tags:     ['Platform Products'],
                summary:  'Sync products from platform (Sync Product button)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        in:          'query',
                        name:        'platformStoreId',
                        schema:      { type: 'integer' },
                        description: 'Omit to sync ALL active stores for the company',
                    },
                ],
                responses: {
                    200: {
                        description: 'Sync result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Sync complete — 150 products updated' },
                                        data:    {
                                            type: 'object',
                                            properties: {
                                                synced: { type: 'integer', example: 150 },
                                                stores: { type: 'integer', example: 2 },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner / admin / manager role' },
                },
            },
        },

        '/platform-products/generate-sku': {
            post: {
                tags:     ['Platform Products'],
                summary:  'Generate Merchant SKU(s) from selected platform products',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['platformProductIds', 'warehouseId'],
                                properties: {
                                    platformProductIds: {
                                        type:     'array',
                                        minItems: 1,
                                        items:    { type: 'integer', minimum: 1 },
                                        example:  [1, 2, 3],
                                    },
                                    warehouseId: { type: 'integer', minimum: 1, example: 1 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'SKUs generated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        data:    { $ref: '#/components/schemas/GenerateSkuResult' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                },
            },
        },

        '/platform-products/auto-mapping': {
            post: {
                tags:     ['Platform Products'],
                summary:  'Auto-map platform products to merchant SKUs by seller_sku match',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['warehouseId'],
                                properties: {
                                    platformProductIds: {
                                        type:        'array',
                                        items:       { type: 'integer', minimum: 1 },
                                        description: 'Omit or pass empty array to auto-map ALL unmapped products',
                                        example:     [4, 5, 6],
                                    },
                                    warehouseId: { type: 'integer', minimum: 1, example: 1 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Auto-mapping result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        data:    { $ref: '#/components/schemas/AutoMappingResult' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                },
            },
        },

        '/platform-products/push-stock': {
            post: {
                tags:     ['Platform Products'],
                summary:  'Push stock quantity back to the platform for a mapping',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['mappingId', 'newQty'],
                                properties: {
                                    mappingId: { type: 'integer', minimum: 1, example: 10 },
                                    newQty:    { type: 'integer', minimum: 0, example: 25 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Stock pushed to platform',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Stock updated on platform' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                pushed:   { type: 'boolean', example: true },
                                                platform: { type: 'string', example: 'shopee' },
                                                newQty:   { type: 'integer', example: 25 },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                    404: { description: 'Mapping not found' },
                },
            },
        },

        '/platform-products/mapping/{mappingId}': {
            delete: {
                tags:     ['Platform Products'],
                summary:  'Unlink (unmap) a platform SKU mapping',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'mappingId', required: true, schema: { type: 'integer' }, example: 10 },
                ],
                responses: {
                    200: {
                        description: 'Mapping removed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Mapping removed' },
                                        data:    { type: 'object', properties: { unlinked: { type: 'integer', example: 10 } } },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                    404: { description: 'Mapping not found' },
                },
            },
        },
    },
};