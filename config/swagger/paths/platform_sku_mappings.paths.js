// module.exports = {
//     schemas: {
//         PlatformSkuMappingResponse: {
//             type: 'object',
//             properties: {
//                 id: { type: 'integer', example: 1 },
//                 company_id: { type: 'integer', example: 1 },
//                 platform_store_id: { type: 'integer', example: 1 },
//                 merchant_sku_id: { type: 'integer', nullable: true, example: 1 },
//                 combine_sku_id: { type: 'integer', nullable: true, example: null },
//                 fulfillment_warehouse_id: { type: 'integer', nullable: true, example: 1 },
//                 platform_sku_id: { type: 'string', nullable: true, example: 'SHOPEE-SKU-001' },
//                 platform_listing_id: { type: 'string', nullable: true, example: 'SHOPEE-LISTING-001' },
//                 platform_model_id: { type: 'string', nullable: true },
//                 sync_status: { type: 'string', enum: ['pending', 'synced', 'failed', 'out_of_sync'], example: 'synced' },
//                 last_synced_at: { type: 'string', format: 'date-time', nullable: true },
//                 is_active: { type: 'boolean', example: true },
//                 platformStore: { type: 'object', properties: { id: { type: 'integer' }, platform: { type: 'string' }, store_name: { type: 'string' } } },
//                 merchantSku: { type: 'object', nullable: true, properties: { id: { type: 'integer' }, sku_name: { type: 'string' }, sku_title: { type: 'string' } } },
//                 combineSku: { type: 'object', nullable: true, properties: { id: { type: 'integer' }, combine_name: { type: 'string' }, computed_quantity: { type: 'integer' } } },
//             },
//         },
//     },
//     paths: {
//         '/platform-sku-mappings/pending-sync': {
//             get: {
//                 tags: ['Platform SKU Mappings'],
//                 summary: 'Get mappings pending platform push — polled by Java',
//                 description: 'Returns up to 100 mappings with sync_status of pending, out_of_sync, or failed. Includes full SKU data Java needs to push to platform.',
//                 security: [{ bearerAuth: [] }],
//                 parameters: [{ in: 'query', name: 'platform', schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] }, description: 'Filter by specific platform' }],
//                 responses: { 200: { description: 'Pending mappings with full SKU payload' } },
//             },
//         },
//         '/platform-sku-mappings': {
//             get: {
//                 tags: ['Platform SKU Mappings'], summary: 'List all SKU mappings',
//                 security: [{ bearerAuth: [] }],
//                 parameters: [
//                     { in: 'query', name: 'platformStoreId', schema: { type: 'integer' } },
//                     { in: 'query', name: 'merchantSkuId', schema: { type: 'integer' } },
//                     { in: 'query', name: 'combineSkuId', schema: { type: 'integer' } },
//                     { in: 'query', name: 'syncStatus', schema: { type: 'string', enum: ['pending', 'synced', 'failed', 'out_of_sync'] } },
//                     { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
//                     { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
//                     { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
//                 ],
//                 responses: { 200: { description: 'Paginated mappings list' } },
//             },
//             post: {
//                 tags: ['Platform SKU Mappings'], summary: 'Create a new SKU-to-store mapping',
//                 description: 'Links a merchant SKU or combine SKU to a platform store listing. Exactly one of merchantSkuId or combineSkuId must be set.',
//                 security: [{ bearerAuth: [] }],
//                 requestBody: {
//                     required: true,
//                     content: {
//                         'application/json': {
//                             schema: {
//                                 type: 'object', required: ['platformStoreId'], properties: {
//                                     platformStoreId: { type: 'integer', example: 1 },
//                                     merchantSkuId: { type: 'integer', nullable: true, example: 1, description: 'Set this OR combineSkuId, not both' },
//                                     combineSkuId: { type: 'integer', nullable: true, example: null },
//                                     fulfillmentWarehouseId: { type: 'integer', nullable: true, example: 1 },
//                                 }
//                             }
//                         }
//                     },
//                 },
//                 responses: { 201: { description: 'Mapping created with sync_status: pending' }, 400: { description: 'Both or neither SKU IDs provided' }, 409: { description: 'Already mapped' } },
//             },
//         },
//         '/platform-sku-mappings/{id}': {
//             get: { tags: ['Platform SKU Mappings'], summary: 'Get mapping by ID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
//             put: { tags: ['Platform SKU Mappings'], summary: 'Update mapping (warehouse, active flag)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { fulfillmentWarehouseId: { type: 'integer' }, isActive: { type: 'boolean' } } } } } }, responses: { 200: { description: 'Updated' } } },
//             delete: { tags: ['Platform SKU Mappings'], summary: 'Delete mapping (soft delete)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Deleted' } } },
//         },
//         '/platform-sku-mappings/{id}/sync-callback': {
//             put: {
//                 tags: ['Platform SKU Mappings'],
//                 summary: 'Sync callback — Java writes back platform listing IDs after product push',
//                 description: 'Called by Java Spring Boot after successfully pushing a product to the platform. Updates sync_status to synced and records platform_listing_id and platform_sku_id.',
//                 security: [{ bearerAuth: [] }],
//                 parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
//                 requestBody: {
//                     required: true,
//                     content: {
//                         'application/json': {
//                             schema: {
//                                 type: 'object', required: ['success'], properties: {
//                                     success: { type: 'boolean', example: true },
//                                     platformSkuId: { type: 'string', example: 'SHOPEE-SKU-001' },
//                                     platformListingId: { type: 'string', example: 'SHOPEE-LISTING-001' },
//                                     platformModelId: { type: 'string', example: 'SHOPEE-MODEL-001' },
//                                     errorMessage: { type: 'string', description: 'Set when success is false' },
//                                 }
//                             }
//                         }
//                     },
//                 },
//                 responses: { 200: { description: 'Sync status updated — mapping now has platform IDs' } },
//             },
//         },
//     },
// };

module.exports = {
    schemas: {
        PlatformSkuMappingResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                platform_store_id: { type: 'integer', example: 1 },
                merchant_sku_id: { type: 'integer', nullable: true, example: 1 },
                combine_sku_id: { type: 'integer', nullable: true, example: null },
                fulfillment_warehouse_id: { type: 'integer', nullable: true, example: 1 },
                platform_sku_id: { type: 'string', nullable: true, example: 'SHOPEE-SKU-001' },
                platform_listing_id: { type: 'string', nullable: true, example: 'SHOPEE-LISTING-001' },
                platform_model_id: { type: 'string', nullable: true, example: 'SHOPEE-MODEL-001' },

                // ── New optional platform-side identifiers ──────────────────
                platform_shop_id:      { type: 'string', nullable: true, example: 'SHOP-123', description: 'Shop/seller ID on the platform (e.g. TikTok shop_id)' },
                platform_open_id:      { type: 'string', nullable: true, example: 'OPEN-ABC', description: 'OAuth open_id for the seller account' },
                platform_cipher_id:    { type: 'string', nullable: true, example: 'CIPHER-XYZ', description: 'Encrypted/cipher ID used by some platforms (e.g. TikTok)' },
                platform_product_id:   { type: 'string', nullable: true, example: 'PROD-456', description: 'Product-level ID on the platform' },
                platform_warehouse_id: { type: 'string', nullable: true, example: 'WH-789', description: 'Warehouse ID on the platform side' },
                platform_item_id:      { type: 'string', nullable: true, example: 'ITEM-101', description: 'Item-level ID (Lazada/Shopee item_id)' },
                platform_location_id:  { type: 'string', nullable: true, example: 'LOC-202', description: 'Location/fulfillment center ID on the platform' },
                // ────────────────────────────────────────────────────────────

                sync_status: { type: 'string', enum: ['pending', 'synced', 'failed', 'out_of_sync'], example: 'synced' },
                last_synced_at: { type: 'string', format: 'date-time', nullable: true },
                sync_error: { type: 'string', nullable: true },
                is_active: { type: 'boolean', example: true },
                platformStore: { type: 'object', properties: { id: { type: 'integer' }, platform: { type: 'string' }, store_name: { type: 'string' } } },
                merchantSku: { type: 'object', nullable: true, properties: { id: { type: 'integer' }, sku_name: { type: 'string' }, sku_title: { type: 'string' } } },
                combineSku: { type: 'object', nullable: true, properties: { id: { type: 'integer' }, combine_name: { type: 'string' }, computed_quantity: { type: 'integer' } } },
            },
        },
    },
    paths: {
        '/platform-sku-mappings/pending-sync': {
            get: {
                tags: ['Platform SKU Mappings'],
                summary: 'Get mappings pending platform push — polled by Java',
                description: 'Returns up to 100 mappings with sync_status of pending, out_of_sync, or failed. Includes full SKU data Java needs to push to platform.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'query', name: 'platform', schema: { type: 'string', enum: ['shopee', 'tiktok', 'lazada'] }, description: 'Filter by specific platform' }],
                responses: {
                    200: {
                        description: 'Pending mappings with full SKU payload',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/PlatformSkuMappingResponse' } },
                            },
                        },
                    },
                },
            },
        },
        '/platform-sku-mappings': {
            get: {
                tags: ['Platform SKU Mappings'],
                summary: 'List all SKU mappings',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platformStoreId', schema: { type: 'integer' } },
                    { in: 'query', name: 'merchantSkuId', schema: { type: 'integer' } },
                    { in: 'query', name: 'combineSkuId', schema: { type: 'integer' } },
                    { in: 'query', name: 'syncStatus', schema: { type: 'string', enum: ['pending', 'synced', 'failed', 'out_of_sync'] } },
                    { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                ],
                responses: {
                    200: {
                        description: 'Paginated mappings list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: { type: 'array', items: { $ref: '#/components/schemas/PlatformSkuMappingResponse' } },
                                        pagination: {
                                            type: 'object',
                                            properties: {
                                                total: { type: 'integer' },
                                                page: { type: 'integer' },
                                                limit: { type: 'integer' },
                                                totalPages: { type: 'integer' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
    post: {
    tags: ['Platform SKU Mappings'],
    summary: 'Create a new SKU-to-store mapping',
    description: 'Links a merchant SKU or combine SKU to a platform store listing. Exactly one of merchantSkuId or combineSkuId must be set.',
    security: [{ bearerAuth: [] }],
    requestBody: {
        required: true,
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    required: ['platformStoreId'],
                    properties: {
                        platformStoreId:        { type: 'integer', example: 1 },
                        merchantSkuId:          { type: 'integer', nullable: true, example: 1, description: 'Set this OR combineSkuId, not both' },
                        combineSkuId:           { type: 'integer', nullable: true, example: null },
                        fulfillmentWarehouseId: { type: 'integer', nullable: true, example: 1 },

                        // ── Optional platform-side identifiers (can be set at creation or later via sync-callback) ──
                        platformShopId:      { type: 'string', nullable: true, example: 'SHOP-123',    description: 'Shop/seller ID on the platform (e.g. TikTok shop_id)' },
                        platformOpenId:      { type: 'string', nullable: true, example: 'OPEN-ABC',    description: 'OAuth open_id for the seller account' },
                        platformCipherId:    { type: 'string', nullable: true, example: 'CIPHER-XYZ',  description: 'Encrypted/cipher ID used by some platforms (e.g. TikTok)' },
                        platformProductId:   { type: 'string', nullable: true, example: 'PROD-456',    description: 'Product-level ID on the platform' },
                        platformWarehouseId: { type: 'string', nullable: true, example: 'WH-789',      description: 'Warehouse ID on the platform side' },
                        platformItemId:      { type: 'string', nullable: true, example: 'ITEM-101',    description: 'Item-level ID (Lazada/Shopee item_id)' },
                        platformModelId:  { type: 'string', nullable: true, example: 'LOC-202',     description: 'Sku Model ID on the platform' },
                        platformLocationId:  { type: 'string', nullable: true, example: 'LOC-202',     description: 'Location/fulfillment center ID on the platform' },
                        // ─────────────────────────────────────────────────────────────────────────────────────────
                    },
                },
                example: {
                    platformStoreId:        1,
                    merchantSkuId:          1,
                    combineSkuId:           null,
                    fulfillmentWarehouseId: 1,
                    platformShopId:         'SHOP-123',
                    platformOpenId:         null,
                    platformCipherId:       null,
                    platformProductId:      null,
                    platformWarehouseId:    null,
                    platformItemId:         null,
                    platformModelId:        null,
                    platformLocationId:     null,
                },
            },
        },
    },
    responses: {
        201: { description: 'Mapping created with sync_status: pending', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformSkuMappingResponse' } } } },
        400: { description: 'Both or neither SKU IDs provided / validation failed' },
        409: { description: 'Already mapped' },
    },
},
        },
        '/platform-sku-mappings/{id}': {
            get: {
                tags: ['Platform SKU Mappings'],
                summary: 'Get mapping by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: {
                    200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformSkuMappingResponse' } } } },
                    404: { description: 'Mapping not found' },
                },
            },
            put: {
                tags: ['Platform SKU Mappings'],
                summary: 'Update mapping (warehouse, active flag)',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    fulfillmentWarehouseId: { type: 'integer', nullable: true },
                                    isActive: { type: 'boolean' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformSkuMappingResponse' } } } },
                    404: { description: 'Mapping not found' },
                },
            },
            delete: {
                tags: ['Platform SKU Mappings'],
                summary: 'Delete mapping (soft delete)',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: {
                    200: { description: 'Deleted' },
                    404: { description: 'Mapping not found' },
                },
            },
        },
        '/platform-sku-mappings/{id}/sync-callback': {
            put: {
                tags: ['Platform SKU Mappings'],
                summary: 'Sync callback — Java writes back platform listing IDs after product push',
                description: 'Called by Java Spring Boot after successfully pushing a product to the platform. Updates sync_status to synced and records platform_listing_id, platform_sku_id, and any optional extended platform IDs.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['success'],
                                properties: {
                                    success:             { type: 'boolean', example: true },
                                    platformSkuId:       { type: 'string', example: 'SHOPEE-SKU-001' },
                                    platformListingId:   { type: 'string', example: 'SHOPEE-LISTING-001' },
                                    platformModelId:     { type: 'string', example: 'SHOPEE-MODEL-001' },
                                    platformShopId:      { type: 'string', example: 'SHOP-123', description: 'Optional: shop/seller ID returned by platform' },
                                    platformOpenId:      { type: 'string', example: 'OPEN-ABC', description: 'Optional: OAuth open_id returned by platform' },
                                    platformCipherId:    { type: 'string', example: 'CIPHER-XYZ', description: 'Optional: cipher/encrypted ID returned by platform' },
                                    platformProductId:   { type: 'string', example: 'PROD-456', description: 'Optional: product-level ID returned by platform' },
                                    platformWarehouseId: { type: 'string', example: 'WH-789', description: 'Optional: warehouse ID on the platform side' },
                                    platformItemId:      { type: 'string', example: 'ITEM-101', description: 'Optional: item-level ID returned by platform' },
                                    platformLocationId:  { type: 'string', example: 'LOC-202', description: 'Optional: location/fulfillment center ID' },
                                    errorMessage:        { type: 'string', description: 'Set when success is false' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Sync status updated — mapping now has platform IDs', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformSkuMappingResponse' } } } },
                    404: { description: 'Mapping not found' },
                },
            },
        },
    },
};