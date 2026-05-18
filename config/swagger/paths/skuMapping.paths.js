module.exports = {
    schemas: {
        MerchantSkuMapping: {
            type: 'object',
            properties: {
                id:                  { type: 'integer', example: 1 },
                platform:            { type: 'string', enum: ['shopee', 'tiktok', 'lazada'], example: 'shopee' },
                store_name:          { type: 'string', example: 'My Shopee Store' },
                platform_store_id:   { type: 'integer', example: 2 },
                platform_listing_id: { type: 'string', example: '987654321' },
                platform_sku_id:     { type: 'string', example: '111222333' },
                sync_status:         { type: 'string', enum: ['pending', 'synced', 'out_of_sync'], example: 'synced' },
                last_synced_at:      { type: 'string', format: 'date-time', nullable: true },
            },
        },

        MerchantSkuListItem: {
            type: 'object',
            properties: {
                id:               { type: 'integer', example: 5 },
                sku_name:         { type: 'string', example: 'TSHIRT-BLUE-M' },
                sku_title:        { type: 'string', nullable: true, example: 'Blue T-Shirt Size M' },
                image_url:        { type: 'string', nullable: true, example: 'https://cdn.example.com/img.jpg' },
                status:           { type: 'string', example: 'active' },
                is_mapped:        { type: 'boolean', example: true },
                mapping_count:    { type: 'integer', example: 2 },
                mapped_store_sku: { type: 'string', nullable: true, example: 'My Shopee Store — 987654321' },
                mappings: {
                    type:  'array',
                    items: { $ref: '#/components/schemas/MerchantSkuMapping' },
                },
            },
        },

        SkuMappingCounts: {
            type: 'object',
            properties: {
                all:      { type: 'integer', example: 200 },
                mapped:   { type: 'integer', example: 130 },
                unmapped: { type: 'integer', example: 70 },
            },
        },

        SkuMappingDropdowns: {
            type: 'object',
            properties: {
                platforms: {
                    type:  'array',
                    items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } },
                    example: [{ label: 'shopee', value: 'shopee' }, { label: 'tiktok', value: 'tiktok' }],
                },
                stores: {
                    type:  'array',
                    items: {
                        type: 'object',
                        properties: {
                            id:       { type: 'integer' },
                            label:    { type: 'string' },
                            value:    { type: 'string' },
                            platform: { type: 'string' },
                        },
                    },
                },
                storesByPlatform: {
                    type:                 'object',
                    additionalProperties: {
                        type:  'array',
                        items: { type: 'object', properties: { id: { type: 'integer' }, label: { type: 'string' }, value: { type: 'string' } } },
                    },
                },
                warehouses: {
                    type:  'array',
                    items: {
                        type: 'object',
                        properties: {
                            id:         { type: 'integer' },
                            label:      { type: 'string' },
                            value:      { type: 'string' },
                            is_default: { type: 'boolean' },
                        },
                    },
                },
            },
        },

        PlatformProductPickerItem: {
            type: 'object',
            properties: {
                id:                   { type: 'integer', example: 1 },
                platform:             { type: 'string', example: 'shopee' },
                platform_product_id:  { type: 'string', example: '987654321' },
                platform_sku_id:      { type: 'string', nullable: true, example: '111222333' },
                platform_model_id:    { type: 'string', nullable: true, example: '111222333' },
                platform_location_id: { type: 'string', nullable: true, example: 'LOC_001' },
                platform_warehouse_id:{ type: 'string', nullable: true, example: 'WH_001' },
                product_name:         { type: 'string', example: 'Blue T-Shirt' },
                variation_name:       { type: 'string', nullable: true, example: 'Size M / Blue' },
                seller_sku:           { type: 'string', nullable: true, example: 'TSHIRT-BLUE-M' },
                image_url:            { type: 'string', nullable: true, example: 'https://cdn.example.com/img.jpg' },
                store_name:           { type: 'string', example: 'My Shopee Store' },
                is_mapped:            { type: 'boolean', example: false },
            },
        },
    },

    paths: {
        '/sku-mapping/dropdowns': {
            get: {
                tags:     ['SKU Mapping'],
                summary:  'Get dropdown data (platforms, stores, warehouses) for filter bars',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Dropdown options',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Dropdowns' },
                                        data:    { $ref: '#/components/schemas/SkuMappingDropdowns' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },

        '/sku-mapping/by-merchant': {
            get: {
                tags:     ['SKU Mapping'],
                summary:  'List merchant SKUs with mapping status (ByMerchantSKUMappingPage)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'page',          schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit',         schema: { type: 'integer', default: 20 } },
                    { in: 'query', name: 'search',        schema: { type: 'string' }, description: 'Search term' },
                    {
                        in: 'query', name: 'skuType',
                        schema: { type: 'string', enum: ['sku_name', 'product_name'], default: 'sku_name' },
                        description: 'Field to apply search against',
                    },
                    {
                        in: 'query', name: 'mappingStatus',
                        schema: { type: 'string', enum: ['all', 'mapped', 'unmapped'], default: 'all' },
                        description: 'Tab filter',
                    },
                ],
                responses: {
                    200: {
                        description: 'Paginated merchant SKU list with mapping details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success:    { type: 'boolean' },
                                        message:    { type: 'string', example: 'Merchant SKUs' },
                                        data:       { type: 'array', items: { $ref: '#/components/schemas/MerchantSkuListItem' } },
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

        '/sku-mapping/by-merchant/counts': {
            get: {
                tags:     ['SKU Mapping'],
                summary:  'Get tab badge counts (all / mapped / unmapped) for merchant SKUs',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Counts',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Counts' },
                                        data:    { $ref: '#/components/schemas/SkuMappingCounts' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },

        '/sku-mapping/product-picker': {
            get: {
                tags:     ['SKU Mapping'],
                summary:  'Get platform products for Add Mapping modal left panel',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platformStoreId', schema: { type: 'integer' }, description: 'Filter by store (required for targeted search)' },
                    {
                        in: 'query', name: 'mappingStatus',
                        schema: { type: 'string', enum: ['all', 'not_mapped'], default: 'all' },
                        description: 'Show all or only unmapped platform products',
                    },
                    {
                        in: 'query', name: 'skuType',
                        schema: { type: 'string', enum: ['product_name', 'sku_name', 'item_id', 'sku_id'], default: 'product_name' },
                        description: 'Field to apply search against',
                    },
                    { in: 'query', name: 'search', schema: { type: 'string' } },
                    { in: 'query', name: 'page',   schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit',  schema: { type: 'integer', default: 50 } },
                ],
                responses: {
                    200: {
                        description: 'Paginated platform product picker list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success:    { type: 'boolean' },
                                        message:    { type: 'string', example: 'Picker' },
                                        data:       { type: 'array', items: { $ref: '#/components/schemas/PlatformProductPickerItem' } },
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

        '/sku-mapping/mapping': {
            post: {
                tags:     ['SKU Mapping'],
                summary:  'Create mapping(s) — Confirm button in Add Mapping modal',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['merchantSkuId', 'platformProductIds'],
                                properties: {
                                    merchantSkuId: { type: 'integer', minimum: 1, example: 5 },
                                    platformProductIds: {
                                        type:     'array',
                                        minItems: 1,
                                        items:    { type: 'integer', minimum: 1 },
                                        example:  [1, 2, 3],
                                    },
                                    platformStoreId: {
                                        type:        'integer',
                                        minimum:     1,
                                        nullable:    true,
                                        example:     2,
                                        description: 'Optional — scopes product lookup to a specific store',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Mapping(s) created',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: '3 mapping(s) created' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                created: { type: 'integer', example: 3 },
                                                skipped: { type: 'integer', example: 0 },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                    404: { description: 'Merchant SKU or platform products not found' },
                },
            },
        },

        '/sku-mapping/mapping/{id}': {
            delete: {
                tags:     ['SKU Mapping'],
                summary:  'Unlink (unmap) a mapping from the merchant SKU side',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer' }, example: 10 },
                ],
                responses: {
                    200: {
                        description: 'Mapping unlinked',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Unlinked' },
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

        '/sku-mapping/sync-mapped': {
            post: {
                tags:     ['SKU Mapping'],
                summary:  'Queue all mappings of a merchant SKU for sync (Sync Mapped button)',
                description: 'Marks platform_sku_mappings as `out_of_sync` so the Java service picks them up and pushes stock/price to the platform.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['merchantSkuId'],
                                properties: {
                                    merchantSkuId: { type: 'integer', minimum: 1, example: 5 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Mappings queued for sync',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: '2 mapping(s) queued for sync' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                queued:  { type: 'integer', example: 2 },
                                                message: { type: 'string', example: '2 mapping(s) queued for sync' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed — merchantSkuId required' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden' },
                },
            },
        },
    },
};