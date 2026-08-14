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
                skuOverrideId: { type: 'integer', nullable: true, example: 3 },
                overrideApplied: { type: 'boolean', example: false },
                replacementMerchantSkuId: { type: 'integer', nullable: true, example: 55 },
                replacementWarehouseId: { type: 'integer', nullable: true, example: 2 },
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
        PlatformOrderSkuOverrideRequest: {
            type: 'object',
            required: ['platform', 'platformOrderId', 'platformOrderItemId', 'replacementMerchantSkuId', 'replacementWarehouseId'],
            properties: {
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'tiktok' },
                platformOrderId: { type: 'string', example: 'TIKTOK-ORDER-1001' },
                platformOrderItemId: { type: 'string', example: 'TIKTOK-LINE-1' },
                originalPlatformMappingId: { type: 'integer', example: 15, description: 'Optional. If omitted, platform/store/SKU identifiers are used to resolve the original mapping.' },
                shopId: { type: 'string', example: 'seller-shop-id' },
                openId: { type: 'string', example: 'seller_open_id' },
                cipherId: { type: 'string', example: 'seller_cipher_id' },
                productId: { type: 'string', example: '1729384756000' },
                itemId: { type: 'string', example: '987654321' },
                skuId: { type: 'string', example: '1729384756999' },
                modelId: { type: 'string', example: '444555666' },
                replacementMerchantSkuId: { type: 'integer', example: 55 },
                replacementWarehouseId: { type: 'integer', example: 2 },
                quantity: { type: 'integer', example: 1 },
                reason: { type: 'string', example: 'out_of_stock' },
                note: { type: 'string', example: 'Original item has no stock, pack replacement color.' },
            },
        },
        PlatformOrderSkuOverrideResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 3 },
                platform: { type: 'string', example: 'tiktok' },
                platformOrderId: { type: 'string', example: 'TIKTOK-ORDER-1001' },
                platformOrderItemId: { type: 'string', example: 'TIKTOK-LINE-1' },
                originalPlatformMappingId: { type: 'integer', example: 15 },
                originalMerchantSkuId: { type: 'integer', nullable: true, example: 10 },
                originalCombineSkuId: { type: 'integer', nullable: true, example: null },
                replacementMerchantSkuId: { type: 'integer', example: 55 },
                replacementWarehouseId: { type: 'integer', example: 2 },
                quantity: { type: 'integer', example: 1 },
                reason: { type: 'string', example: 'out_of_stock' },
                note: { type: 'string', nullable: true, example: 'Original item has no stock, pack replacement color.' },
                status: { type: 'string', enum: ['active', 'packed', 'cancelled'], example: 'active' },
            },
        },
        PlatformOrderSkuOverrideDeleteRequest: {
            type: 'object',
            required: ['platform', 'platformOrderId'],
            properties: {
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'shopee' },
                platformOrderId: { type: 'string', example: 'SHOPEE-ORDER-1001' },
                orderId: { type: 'string', example: 'SHOPEE-ORDER-1001', description: 'Optional alias for platformOrderId.' },
                orderNo: { type: 'string', example: 'SHOPEE-ORDER-1001', description: 'Optional alias for platformOrderId.' },
                platformOrderItemId: { type: 'string', example: 'SHOPEE-ITEM-1', description: 'Optional. If omitted, all override rows for the order are deleted.' },
                orderItemId: { type: 'string', example: 'SHOPEE-ITEM-1', description: 'Optional alias for platformOrderItemId.' },
                shopId: { type: 'string', example: '123456' },
                openId: { type: 'string', example: 'seller_open_id' },
                cipherId: { type: 'string', example: 'seller_cipher_id' },
            },
        },
        PlatformOrderSkuOverrideDeleteResponse: {
            type: 'object',
            properties: {
                platform: { type: 'string', example: 'shopee' },
                platformOrderId: { type: 'string', example: 'SHOPEE-ORDER-1001' },
                platformOrderItemId: { type: 'string', nullable: true, example: null },
                deletedCount: { type: 'integer', example: 2 },
            },
        },
        PlatformOrderPackStockRequest: {
            type: 'object',
            required: ['platform', 'order'],
            properties: {
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'tiktok' },
                orderId: { type: 'string', example: 'TIKTOK-ORDER-1001', description: 'Optional top-level alias when order.orderId is not sent.' },
                shopId: { type: 'string', example: 'seller-shop-id', description: 'Optional top-level store identifier.' },
                openId: { type: 'string', example: 'seller_open_id', description: 'Optional TikTok store identifier.' },
                cipherId: { type: 'string', example: 'seller_cipher_id', description: 'Optional TikTok store identifier.' },
                order: {
                    type: 'object',
                    required: ['orderId', 'items'],
                    properties: {
                        orderId: { type: 'string', example: 'TIKTOK-ORDER-1001' },
                        orderNo: { type: 'string', example: 'TIKTOK-ORDER-1001' },
                        externalStoreId: { type: 'string', example: 'external-store-id' },
                        shopId: { type: 'string', example: 'seller-shop-id' },
                        openId: { type: 'string', example: 'seller_open_id' },
                        cipherId: { type: 'string', example: 'seller_cipher_id' },
                        items: {
                            type: 'array',
                            minItems: 1,
                            items: {
                                type: 'object',
                                properties: {
                                    orderItemId: { type: 'string', example: 'TIKTOK-LINE-1' },
                                    productId: { type: 'string', example: '1729384756000' },
                                    itemId: { type: 'string', example: '987654321' },
                                    skuId: { type: 'string', example: '1729384756999' },
                                    modelId: { type: 'string', example: '444555666' },
                                    listingId: { type: 'string', example: 'listing-id' },
                                    quantity: { type: 'integer', example: 1 },
                                },
                            },
                        },
                    },
                },
            },
        },
        PlatformOrderPackStockResponse: {
            type: 'object',
            properties: {
                count: { type: 'integer', example: 1 },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            itemId: { type: 'string', example: 'TIKTOK-LINE-1' },
                            result: { $ref: '#/components/schemas/PlatformOrderDeductResponse' },
                        },
                    },
                },
            },
        },
    },
    paths: {
        '/platform-order-deductions/sku-override': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Save replacement SKU override for one platform order item',
                description: 'Public no-JWT endpoint. Use this before pack-stock when the original mapped SKU is unavailable and a different merchant SKU should be packed for this order item only.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PlatformOrderSkuOverrideRequest' },
                            examples: {
                                shopee: {
                                    value: {
                                        platform: 'shopee',
                                        platformOrderId: 'SHOPEE-ORDER-1001',
                                        platformOrderItemId: 'SHOPEE-ITEM-1',
                                        shopId: '123456',
                                        itemId: '987654321',
                                        modelId: '444555666',
                                        replacementMerchantSkuId: 55,
                                        replacementWarehouseId: 2,
                                        quantity: 2,
                                        reason: 'out_of_stock',
                                    },
                                },
                                tiktok: {
                                    value: {
                                        platform: 'tiktok',
                                        platformOrderId: 'TIKTOK-ORDER-1001',
                                        platformOrderItemId: 'TIKTOK-LINE-1',
                                        shopId: 'seller-shop-id',
                                        openId: 'seller_open_id',
                                        cipherId: 'seller_cipher_id',
                                        productId: '1729384756000',
                                        skuId: '1729384756999',
                                        replacementMerchantSkuId: 55,
                                        replacementWarehouseId: 2,
                                        quantity: 1,
                                        reason: 'out_of_stock',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'SKU override saved', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/PlatformOrderSkuOverrideResponse' } } } } } },
                    400: { description: 'Missing identifiers or insufficient replacement stock' },
                    404: { description: 'Original mapping, replacement SKU, or replacement warehouse not found' },
                    409: { description: 'Multiple original mappings matched' },
                },
            },
            delete: {
                tags: ['Platform Order Deductions'],
                summary: 'Delete replacement SKU overrides for one platform order',
                description: 'Public no-JWT endpoint. Deletes saved SKU override rows for a platform order. If platformOrderItemId/orderItemId is omitted, all override rows for the order are deleted. Returns deletedCount and succeeds even when no rows matched.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PlatformOrderSkuOverrideDeleteRequest' },
                            examples: {
                                shopee: {
                                    value: {
                                        platform: 'shopee',
                                        platformOrderId: 'SHOPEE-ORDER-1001',
                                        orderNo: 'SHOPEE-ORDER-1001',
                                        shopId: '123456',
                                    },
                                },
                                tiktok: {
                                    value: {
                                        platform: 'tiktok',
                                        platformOrderId: 'TIKTOK-ORDER-1001',
                                        orderNo: 'TIKTOK-ORDER-1001',
                                        shopId: 'seller-shop-id',
                                        openId: 'seller_open_id',
                                        cipherId: 'seller_cipher_id',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'SKU overrides deleted', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/PlatformOrderSkuOverrideDeleteResponse' } } } } } },
                    400: { description: 'Missing platform or orderId' },
                },
            },
        },
        '/platform-order-deductions/pack-stock': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Finalize packed stock from public platform order notification',
                description: 'Public no-JWT endpoint for Shopee/TikTok packed orders. It packs reserved stock for order items using platform/store/SKU identifiers and reduces mapped platform stock by the packed quantity using platform reduce-stock APIs. warehouseId is not required.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PlatformOrderPackStockRequest' },
                            examples: {
                                shopee: {
                                    value: {
                                        platform: 'shopee',
                                        order: {
                                            orderId: 'SHOPEE-ORDER-1001',
                                            shopId: '123456',
                                            items: [
                                                {
                                                    orderItemId: 'SHOPEE-ITEM-1',
                                                    itemId: '987654321',
                                                    modelId: '444555666',
                                                    quantity: 2,
                                                },
                                            ],
                                        },
                                    },
                                },
                                tiktok: {
                                    value: {
                                        platform: 'tiktok',
                                        order: {
                                            orderId: 'TIKTOK-ORDER-1001',
                                            shopId: 'seller-shop-id',
                                            openId: 'seller_open_id',
                                            cipherId: 'seller_cipher_id',
                                            items: [
                                                {
                                                    orderItemId: 'TIKTOK-LINE-1',
                                                    productId: '1729384756000',
                                                    skuId: '1729384756999',
                                                    quantity: 1,
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Packed stock finalized', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/PlatformOrderPackStockResponse' } } } } } },
                    400: { description: 'Missing platform, orderId, items, or product/SKU identifiers' },
                    404: { description: 'Store or SKU mapping not found' },
                    409: { description: 'Multiple mappings matched or stock cannot be packed' },
                },
            },
        },
        '/platform-order-deductions/shopee': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Deduct stock from a Shopee order notification',
                description: 'Public no-auth/no-rate-limit Shopee callback. Receives Shopee order item identifiers, resolves company from the mapped Shopee store/SKU, reserves warehouse stock once, and keeps related mappings synchronized.',
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
                description: 'Public no-auth/no-rate-limit TikTok callback. Receives TikTok order item identifiers, resolves company from the mapped TikTok store/SKU, reserves warehouse stock once, and keeps related mappings synchronized.',
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
        '/platform-order-deductions/shopee/cancel': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Release reserved stock for a canceled Shopee order item',
                description: 'Public no-auth/no-rate-limit Shopee cancel callback. Use when a reserved READY_TO_SHIP order is canceled before SHIPPED. Releases ERP reserved stock and calls the same Shopee SKU increase-stock API once.',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ShopeeOrderDeductRequest' } } },
                },
                responses: {
                    200: { description: 'Reserved stock released, already released, or already packed' },
                    400: { description: 'Missing identifiers' },
                    404: { description: 'Store or SKU mapping not found' },
                    409: { description: 'Order item was packed while release was processing' },
                    502: { description: 'Shopee increase-stock API failed' },
                },
            },
        },
        '/platform-order-deductions/tiktok/cancel': {
            post: {
                tags: ['Platform Order Deductions'],
                summary: 'Release reserved stock for a canceled TikTok order item',
                description: 'Public no-auth/no-rate-limit TikTok cancel callback. Use when a reserved AWAITING_SHIPMENT order is canceled before IN_TRANSIT. Releases ERP reserved stock and calls the same TikTok SKU increase-stock API once.',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/TikTokOrderDeductRequest' } } },
                },
                responses: {
                    200: { description: 'Reserved stock released, already released, or already packed' },
                    400: { description: 'Missing identifiers' },
                    404: { description: 'Store or SKU mapping not found' },
                    409: { description: 'Order item was packed while release was processing' },
                    502: { description: 'TikTok increase-stock API failed' },
                },
            },
        },
    },
};
