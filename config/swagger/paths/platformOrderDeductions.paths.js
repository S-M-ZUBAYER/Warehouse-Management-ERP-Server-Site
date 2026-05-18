module.exports = {
    schemas: {
        ShopeeOrderDeductRequest: {
            type: 'object',
            required: ['platformOrderId', 'platformOrderItemId', 'quantitySold', 'shopId', 'itemId', 'modelId'],
            properties: {
                platformOrderId: { type: 'string', example: 'SHOPEE-ORDER-1001' },
                platformOrderItemId: { type: 'string', example: 'SHOPEE-ITEM-1' },
                quantitySold: { type: 'integer', example: 2 },
                shopId: { type: 'string', example: '123456' },
                itemId: { type: 'string', example: '987654321' },
                modelId: { type: 'string', example: '444555666' },
            },
        },
        TikTokOrderDeductRequest: {
            type: 'object',
            required: ['platformOrderId', 'platformOrderItemId', 'quantitySold', 'openId', 'cipherId', 'productId', 'skuId', 'warehouseId'],
            properties: {
                platformOrderId: { type: 'string', example: 'TIKTOK-ORDER-1001' },
                platformOrderItemId: { type: 'string', example: 'TIKTOK-LINE-1' },
                quantitySold: { type: 'integer', example: 1 },
                openId: { type: 'string', example: 'seller_open_id' },
                cipherId: { type: 'string', example: 'seller_cipher_id' },
                productId: { type: 'string', example: '1729384756000' },
                skuId: { type: 'string', example: '1729384756999' },
                warehouseId: { type: 'string', example: 'TTS_WH_001' },
            },
        },
        PlatformOrderDeductResponse: {
            type: 'object',
            properties: {
                alreadyDeducted: { type: 'boolean', example: false },
                platform: { type: 'string', example: 'shopee' },
                platformMappingId: { type: 'integer', example: 15 },
                platformOrderId: { type: 'string', example: 'SHOPEE-ORDER-1001' },
                syncMarkedOutOfSync: { type: 'integer', example: 4 },
                affectedMerchantSkuIds: { type: 'array', items: { type: 'integer' }, example: [1, 2] },
                deductions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            merchantSkuId: { type: 'integer', example: 1 },
                            deductQty: { type: 'integer', example: 2 },
                            newQtyOnHand: { type: 'integer', example: 48 },
                        },
                    },
                },
                combineSkuId: { type: 'integer', nullable: true, example: null },
                platformStockSync: {
                    type: 'object',
                    nullable: true,
                    properties: {
                        total: { type: 'integer', example: 2 },
                        synced: { type: 'integer', example: 2 },
                        failed: { type: 'integer', example: 0 },
                        results: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    mappingId: { type: 'integer', example: 15 },
                                    merchantSkuId: { type: 'integer', nullable: true, example: 1 },
                                    combineSkuId: { type: 'integer', nullable: true, example: null },
                                    stock: { type: 'integer', example: 48 },
                                    success: { type: 'boolean', example: true },
                                    error: { type: 'string', nullable: true, example: null },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    paths: {
        '/platform-order-deductions/shopee': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Deduct stock from a Shopee order notification',
                description: 'Public no-auth/no-rate-limit Shopee callback. Receives Shopee order item identifiers, resolves company from the mapped Shopee store/SKU, deducts warehouse stock once, and marks related mappings out_of_sync for stock push.',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopeeOrderDeductRequest' } } },
                },
                responses: {
                    200: { description: 'Stock deducted or already deducted', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/PlatformOrderDeductResponse' } } } } } },
                    400: { description: 'Missing identifiers or insufficient stock' },
                    404: { description: 'Store or SKU mapping not found' },
                    409: { description: 'Multiple mappings matched' },
                },
            },
        },
        '/platform-order-deductions/tiktok': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Deduct stock from a TikTok order notification',
                description: 'Public no-auth/no-rate-limit TikTok callback. Receives TikTok order item identifiers, resolves company from the mapped TikTok store/SKU, deducts warehouse stock once, and pushes updated stock to related TikTok mappings.',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/TikTokOrderDeductRequest' } } },
                },
                responses: {
                    200: { description: 'Stock deducted or already deducted', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/PlatformOrderDeductResponse' } } } } } },
                    400: { description: 'Missing identifiers or insufficient stock' },
                    404: { description: 'Store or SKU mapping not found' },
                    409: { description: 'Multiple mappings matched' },
                },
            },
        },
    },
};
