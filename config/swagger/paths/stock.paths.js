module.exports = {
    schemas: {
        StockDeductRequest: {
            type: 'object', required: ['platformMappingId', 'platformOrderId', 'quantitySold'],
            properties: {
                platformMappingId: { type: 'integer', example: 5, description: 'ID from platform_sku_mappings table' },
                platformOrderId: { type: 'string', example: 'SHOP-ORD-001', description: 'Platform-assigned order ID' },
                platformOrderItemId: { type: 'string', example: 'SHOP-ITEM-001', description: 'Platform order item ID (for partial deductions)' },
                quantitySold: { type: 'integer', example: 2, description: 'Units sold — applied × ratio for combine SKUs' },
            },
        },
        StockDeductResponse: {
            type: 'object',
            properties: {
                alreadyDeducted: { type: 'boolean', example: false },
                platformOrderId: { type: 'string', example: 'SHOP-ORD-001' },
                deductions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            merchantSkuId: { type: 'integer', example: 1 },
                            newQtyOnHand: { type: 'integer', example: 148 },
                        },
                    },
                },
                combineSkuId: { type: 'integer', nullable: true, example: 3 },
            },
        },
    },
    paths: {
        '/stock/merchant/{merchantSkuId}': {
            get: {
                tags: ['Stock'], summary: 'Get stock by merchant SKU',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'merchantSkuId', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Stock totals + per-warehouse breakdown' }, 404: { description: 'SKU not found' } },
            },
        },
        '/stock/combine/{combineSkuId}': {
            get: {
                tags: ['Stock'], summary: 'Get stock by combine SKU',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'combineSkuId', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Combine SKU with computed_quantity and child stock' }, 404: { description: 'Not found' } },
            },
        },
        '/stock/bulk': {
            post: {
                tags: ['Stock'], summary: 'Bulk stock query — for Java startup sync',
                description: 'Pass arrays of merchant SKU IDs and combine SKU IDs. Returns aggregated stock map keyed by SKU ID.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', properties: {
                                    merchantSkuIds: { type: 'array', items: { type: 'integer' }, example: [1, 2, 3] },
                                    combineSkuIds: { type: 'array', items: { type: 'integer' }, example: [1] },
                                }
                            }
                        }
                    },
                },
                responses: { 200: { description: 'Bulk stock map returned' } },
            },
        },
        '/stock/adjust': {
            post: {
                tags: ['Stock'], summary: 'Manual stock adjustment (admin only)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', required: ['merchantSkuId', 'warehouseId', 'adjustmentQty'], properties: {
                                    merchantSkuId: { type: 'integer', example: 1 },
                                    warehouseId: { type: 'integer', example: 1 },
                                    adjustmentQty: { type: 'integer', example: -5, description: 'Positive to add, negative to remove' },
                                    notes: { type: 'string', example: 'Damaged goods written off' },
                                }
                            }
                        }
                    },
                },
                responses: { 200: { description: 'Stock adjusted, ledger entry written' }, 400: { description: 'Would result in negative stock' } },
            },
        },
        '/stock/deduct': {
            post: {
                tags: ['Stock'],
                summary: 'Deduct stock after platform sale — called by Java',
                description: 'Idempotent. If the platformOrderId has already been deducted, returns 200 with alreadyDeducted:true. For combine SKUs, deducts each child SKU proportionally. After commit, queues combine SKU recomputation.',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StockDeductRequest' } } } },
                responses: {
                    200: { description: 'Stock deducted or already deducted (idempotent)', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/StockDeductResponse' } } } } } },
                    400: { description: 'Insufficient stock or mapping not found' },
                    404: { description: 'Mapping not found' },
                },
            },
        },
        '/stock/ledger': {
            get: {
                tags: ['Stock'], summary: 'Get stock movement ledger (audit log)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'merchantSkuId', schema: { type: 'integer' }, description: 'Filter by merchant SKU ID' },
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' }, description: 'Filter by warehouse ID' },
                    { in: 'query', name: 'skuName', schema: { type: 'string' }, description: 'Filter by SKU name (partial, case-insensitive)' },
                    { in: 'query', name: 'movementType', schema: { type: 'string', enum: ['inbound_receipt', 'sale_deduction', 'manual_adjustment', 'return'] }, description: 'Filter by movement type' },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 30 } },
                ],
                responses: { 200: { description: 'Paginated ledger entries, most recent first' } },
            },
        },
    },
};