'use strict';

module.exports = {
    schemas: {
        ReturnOrderLine: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                merchantSkuId: { type: 'integer', nullable: true, example: 334 },
                sku: { type: 'string', example: 'PJ100150-120' },
                productName: { type: 'string', example: 'Thermal sticker label' },
                image: { type: 'string', nullable: true },
                quantity: { type: 'integer', example: 1 },
                refundCurrency: { type: 'string', nullable: true, example: 'MYR' },
                refundTotal: { type: 'number', nullable: true, example: 49.9 },
            },
        },
        ReturnOrder: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                platform: { type: 'string', enum: ['manual', 'shopee', 'tiktok'], example: 'tiktok' },
                platformLabel: { type: 'string', example: 'TikTok' },
                platformStoreId: { type: 'integer', nullable: true, example: 2 },
                storeName: { type: 'string', example: 'GROZZIIE TH' },
                warehouseId: { type: 'integer', nullable: true, example: 3 },
                warehouseName: { type: 'string', example: 'Grozziie' },
                platformReturnId: { type: 'string', nullable: true },
                platformOrderId: { type: 'string', nullable: true },
                orderNumber: { type: 'string', example: '577310000000000000' },
                warehousePackageNo: { type: 'string', nullable: true },
                trackingNo: { type: 'string', nullable: true },
                logisticName: { type: 'string', nullable: true },
                returnStatus: { type: 'string', enum: ['need_to_check', 'defect_found', 'pending_inspection', 'resalable_item'] },
                platformReturnStatus: { type: 'string', nullable: true },
                platformStatusLabel: { type: 'string', nullable: true },
                returnReason: { type: 'string', nullable: true },
                returnReasonText: { type: 'string', nullable: true },
                returnType: { type: 'string', nullable: true },
                remark: { type: 'string', nullable: true },
                refundCurrency: { type: 'string', nullable: true },
                refundTotal: { type: 'number', nullable: true },
                isManual: { type: 'boolean', example: false },
                isResaleableInbounded: { type: 'boolean', example: false },
                products: { type: 'array', items: { $ref: '#/components/schemas/ReturnOrderLine' } },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        },
        ManualReturnOrderRequest: {
            type: 'object',
            required: ['warehouseId', 'orderNumber', 'lines'],
            properties: {
                warehouseId: { type: 'integer', example: 3 },
                orderNumber: { type: 'string', example: 'MANUAL-RETURN-001' },
                warehousePackageNo: { type: 'string', example: 'PKG-001' },
                trackingNumber: { type: 'string', example: 'RET123456' },
                logisticName: { type: 'string', example: 'J&T Express' },
                storeName: { type: 'string', example: 'Manual Return' },
                remark: { type: 'string', example: 'Customer returned by hand' },
                lines: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['merchantSkuId', 'quantity'],
                        properties: {
                            merchantSkuId: { type: 'integer', example: 334 },
                            quantity: { type: 'integer', example: 1 },
                            sku: { type: 'string', example: 'PJ100150-120' },
                            productName: { type: 'string', example: 'Thermal sticker label' },
                            image: { type: 'string', nullable: true },
                        },
                    },
                },
            },
        },
        ReturnStatusUpdateRequest: {
            type: 'object',
            required: ['returnStatus', 'returnType', 'warehouseId'],
            properties: {
                returnStatus: { type: 'string', enum: ['need_to_check', 'defect_found', 'pending_inspection', 'resalable_item'], example: 'resalable_item' },
                returnType: { type: 'string', enum: ['by_logistic', 'by_buyer_use_logistic', 'by_buyer_direct_give', 'without_logistic'], example: 'by_logistic' },
                warehouseId: { type: 'integer', example: 3 },
                returnTrackingNo: { type: 'string', example: 'RET123456' },
                logisticName: { type: 'string', example: 'J&T Express' },
                remark: { type: 'string', example: 'Package checked and resalable' },
            },
        },
    },
    paths: {
        '/return-orders': {
            get: {
                tags: ['Return Orders'],
                summary: 'List stored return orders',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platform', schema: { type: 'string', enum: ['all', 'manual', 'shopee', 'tiktok'] } },
                    { in: 'query', name: 'storeId', schema: { oneOf: [{ type: 'string' }, { type: 'integer' }] } },
                    { in: 'query', name: 'warehouseId', schema: { oneOf: [{ type: 'string' }, { type: 'integer' }] } },
                    { in: 'query', name: 'status', schema: { type: 'string' } },
                    { in: 'query', name: 'search', schema: { type: 'string' } },
                    { in: 'query', name: 'searchType', schema: { type: 'string', enum: ['Single Search', 'Batch Search'] } },
                    { in: 'query', name: 'skuType', schema: { type: 'string', enum: ['SKU', 'Order Number', 'Tracking Number', 'Return ID'] } },
                    { in: 'query', name: 'startDate', schema: { type: 'integer', description: 'Unix timestamp in seconds. Filters stored return orders by updated_at.' } },
                    { in: 'query', name: 'endDate', schema: { type: 'integer', description: 'Unix timestamp in seconds. Filters stored return orders by updated_at.' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                ],
                responses: {
                    200: {
                        description: 'Return orders fetched successfully',
                        content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/PaginatedResponse' }] } } },
                    },
                },
            },
        },
        '/return-orders/sync/tiktok': {
            post: {
                tags: ['Return Orders'],
                summary: 'Sync TikTok return orders for a date range',
                description: 'Calls the TikTok Java platform API search endpoint, stores new returns, and updates statuses/reasons for existing returns. Uses startDate/endDate when supplied; otherwise falls back to days.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    platformStoreId: { oneOf: [{ type: 'string', example: 'all' }, { type: 'integer', example: 2 }] },
                                    days: { type: 'integer', minimum: 1, maximum: 30, default: 7 },
                                    startDate: { type: 'integer', description: 'Unix timestamp in seconds. Overrides days when paired with endDate.' },
                                    endDate: { type: 'integer', description: 'Unix timestamp in seconds. Overrides days when paired with startDate.' },
                                    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'TikTok return orders synced successfully' } },
            },
        },
        '/return-orders/sync/shopee': {
            post: {
                tags: ['Return Orders'],
                summary: 'Sync Shopee return orders for a date range',
                description: 'Calls the Shopee Java platform API return list endpoint with createTimeFrom/createTimeTo epoch seconds, stores new returns, and updates statuses/reasons for existing returns. Uses startDate/endDate when supplied; otherwise falls back to days.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    platformStoreId: { oneOf: [{ type: 'string', example: 'all' }, { type: 'integer', example: 1 }] },
                                    days: { type: 'integer', minimum: 1, maximum: 30, default: 7 },
                                    startDate: { type: 'integer', description: 'Unix timestamp in seconds. Overrides days when paired with endDate.' },
                                    endDate: { type: 'integer', description: 'Unix timestamp in seconds. Overrides days when paired with startDate.' },
                                    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Shopee return orders synced successfully' } },
            },
        },
        '/return-orders/manual': {
            post: {
                tags: ['Return Orders'],
                summary: 'Create a manual return order',
                description: 'Creates informational manual return data only. No stock deduction or inbound happens until the return status is changed to Resalable Item.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ManualReturnOrderRequest' } } },
                },
                responses: {
                    201: { description: 'Manual return order created successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
                },
            },
        },
        '/return-orders/{id}': {
            get: {
                tags: ['Return Orders'],
                summary: 'Get return order details',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Return order fetched successfully' } },
            },
            delete: {
                tags: ['Return Orders'],
                summary: 'Delete a return order',
                description: 'Requires typing the exact order number. Return orders that already created resaleable inbound stock cannot be deleted.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['orderNumber'],
                                properties: { orderNumber: { type: 'string', example: 'MANUAL-RETURN-001' } },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Return order deleted successfully' } },
            },
        },
        '/return-orders/{id}/status': {
            patch: {
                tags: ['Return Orders'],
                summary: 'Update ERP return status',
                description: 'When returnStatus is resalable_item, the API creates a completed manual inbound, increases local inventory, logs a return movement, recomputes combine SKUs, and increases mapped platform stock.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ReturnStatusUpdateRequest' } } },
                },
                responses: { 200: { description: 'Return status updated successfully' } },
            },
        },
    },
};
