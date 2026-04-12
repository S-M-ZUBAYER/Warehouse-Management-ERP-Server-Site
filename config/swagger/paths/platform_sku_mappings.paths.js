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
                platform_model_id: { type: 'string', nullable: true },
                sync_status: { type: 'string', enum: ['pending', 'synced', 'failed', 'out_of_sync'], example: 'synced' },
                last_synced_at: { type: 'string', format: 'date-time', nullable: true },
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
                responses: { 200: { description: 'Pending mappings with full SKU payload' } },
            },
        },
        '/platform-sku-mappings': {
            get: {
                tags: ['Platform SKU Mappings'], summary: 'List all SKU mappings',
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
                responses: { 200: { description: 'Paginated mappings list' } },
            },
            post: {
                tags: ['Platform SKU Mappings'], summary: 'Create a new SKU-to-store mapping',
                description: 'Links a merchant SKU or combine SKU to a platform store listing. Exactly one of merchantSkuId or combineSkuId must be set.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', required: ['platformStoreId'], properties: {
                                    platformStoreId: { type: 'integer', example: 1 },
                                    merchantSkuId: { type: 'integer', nullable: true, example: 1, description: 'Set this OR combineSkuId, not both' },
                                    combineSkuId: { type: 'integer', nullable: true, example: null },
                                    fulfillmentWarehouseId: { type: 'integer', nullable: true, example: 1 },
                                }
                            }
                        }
                    },
                },
                responses: { 201: { description: 'Mapping created with sync_status: pending' }, 400: { description: 'Both or neither SKU IDs provided' }, 409: { description: 'Already mapped' } },
            },
        },
        '/platform-sku-mappings/{id}': {
            get: { tags: ['Platform SKU Mappings'], summary: 'Get mapping by ID', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
            put: { tags: ['Platform SKU Mappings'], summary: 'Update mapping (warehouse, active flag)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { fulfillmentWarehouseId: { type: 'integer' }, isActive: { type: 'boolean' } } } } } }, responses: { 200: { description: 'Updated' } } },
            delete: { tags: ['Platform SKU Mappings'], summary: 'Delete mapping (soft delete)', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Deleted' } } },
        },
        '/platform-sku-mappings/{id}/sync-callback': {
            put: {
                tags: ['Platform SKU Mappings'],
                summary: 'Sync callback — Java writes back platform listing IDs after product push',
                description: 'Called by Java Spring Boot after successfully pushing a product to the platform. Updates sync_status to synced and records platform_listing_id and platform_sku_id.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', required: ['success'], properties: {
                                    success: { type: 'boolean', example: true },
                                    platformSkuId: { type: 'string', example: 'SHOPEE-SKU-001' },
                                    platformListingId: { type: 'string', example: 'SHOPEE-LISTING-001' },
                                    platformModelId: { type: 'string', example: 'SHOPEE-MODEL-001' },
                                    errorMessage: { type: 'string', description: 'Set when success is false' },
                                }
                            }
                        }
                    },
                },
                responses: { 200: { description: 'Sync status updated — mapping now has platform IDs' } },
            },
        },
    },
};