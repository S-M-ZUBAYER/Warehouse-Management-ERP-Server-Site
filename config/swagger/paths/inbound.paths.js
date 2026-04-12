module.exports = {
    schemas: {
        InboundOrderResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                warehouse_id: { type: 'integer', example: 1 },
                inbound_id: { type: 'string', example: 'IB-2024-000001' },
                status: { type: 'string', enum: ['draft', 'on_the_way', 'completed', 'cancelled'], example: 'draft' },
                tracking_number: { type: 'string', nullable: true, example: 'TRK-ABC123' },
                purchase_currency: { type: 'string', nullable: true, example: 'USD' },
                exchange_rate: { type: 'number', nullable: true, example: 4.65 },
                supplier_name: { type: 'string', nullable: true, example: 'Acme Supplies Ltd' },
                supplier_reference: { type: 'string', nullable: true, example: 'PO-2024-001' },
                shipping_cost: { type: 'number', nullable: true, example: 25.50 },
                estimated_arrival: { type: 'string', format: 'date', nullable: true, example: '2024-02-15' },
                shipped_at: { type: 'string', format: 'date-time', nullable: true },
                arrived_at: { type: 'string', format: 'date-time', nullable: true },
                warehouse: {
                    type: 'object', nullable: true,
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Main Warehouse' },
                        code: { type: 'string', example: 'WH-001' },
                    },
                },
                lines: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer', example: 1 },
                            merchant_sku_id: { type: 'integer', example: 1 },
                            qty_expected: { type: 'integer', example: 100 },
                            qty_received: { type: 'integer', example: 0 },
                            unit_cost: { type: 'number', nullable: true, example: 12.50 },
                            has_discrepancy: { type: 'boolean', example: false },
                            merchantSku: {
                                type: 'object',
                                properties: {
                                    id: { type: 'integer', example: 1 },
                                    sku_name: { type: 'string', example: 'WM-001' },
                                    sku_title: { type: 'string', example: 'Wireless Mouse' },
                                    image_url: { type: 'string', nullable: true },
                                },
                            },
                        },
                    },
                },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
            },
        },
    },

    paths: {
        '/inbound/dropdowns': {
            get: {
                tags: ['Inbound'],
                summary: 'Get dropdowns for inbound form',
                description: 'Returns warehouses and supported currencies for the create inbound form.',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Dropdowns fetched' } },
            },
        },
        '/inbound/picker': {
            get: {
                tags: ['Inbound'],
                summary: 'SKU picker for adding inbound lines',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' }, description: 'Filter SKUs by warehouse' },
                    { in: 'query', name: 'search', schema: { type: 'string' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                ],
                responses: { 200: { description: 'SKUs fetched with stock levels' } },
            },
        },
        '/inbound': {
            get: {
                tags: ['Inbound'],
                summary: 'List inbound orders',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'status', schema: { type: 'string', enum: ['draft', 'on_the_way', 'completed', 'cancelled', 'all'] } },
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' } },
                    { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by inbound_id, tracking, or supplier' },
                    { in: 'query', name: 'dateFrom', schema: { type: 'string', format: 'date' } },
                    { in: 'query', name: 'dateTo', schema: { type: 'string', format: 'date' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                    { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['created_at', 'updated_at', 'estimated_arrival', 'inbound_id'] } },
                    { in: 'query', name: 'sortOrder', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
                ],
                responses: { 200: { description: 'Inbound orders fetched', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/InboundOrderResponse' } } } } } } } },
            },
            post: {
                tags: ['Inbound'],
                summary: 'Create draft inbound order',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['warehouseId', 'lines'],
                                properties: {
                                    warehouseId: { type: 'integer', example: 1 },
                                    supplierName: { type: 'string', example: 'Acme Supplies' },
                                    supplierReference: { type: 'string', example: 'PO-001' },
                                    notes: { type: 'string' },
                                    lines: {
                                        type: 'array', minItems: 1,
                                        items: {
                                            type: 'object', required: ['merchantSkuId', 'qtyExpected'],
                                            properties: {
                                                merchantSkuId: { type: 'integer', example: 1 },
                                                qtyExpected: { type: 'integer', example: 100 },
                                                unitCost: { type: 'number', example: 12.50 },
                                                currency: { type: 'string', example: 'USD' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Draft created with inbound_id', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/InboundOrderResponse' } } } } } },
                    400: { description: 'Validation failed' },
                    403: { description: 'Forbidden' },
                },
            },
        },
        '/inbound/{id}': {
            get: {
                tags: ['Inbound'], summary: 'Get inbound order by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Inbound order detail' }, 404: { description: 'Not found' } },
            },
        },
        '/inbound/{id}/ship': {
            put: {
                tags: ['Inbound'],
                summary: 'Ship inbound — draft → on_the_way',
                description: 'Confirms shipment details and increments qty_inbound for each SKU line.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', required: ['trackingNumber', 'purchaseCurrency', 'estimatedArrival'],
                                properties: {
                                    trackingNumber: { type: 'string', example: 'TRK-ABC123' },
                                    purchaseCurrency: { type: 'string', example: 'USD' },
                                    estimatedArrival: { type: 'string', format: 'date', example: '2024-02-15' },
                                    exchangeRate: { type: 'number', example: 4.65 },
                                    shippingCost: { type: 'number', example: 25.50 },
                                    notes: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Status updated to on_the_way, qty_inbound incremented' }, 400: { description: 'Cannot ship — wrong status' } },
            },
        },
        '/inbound/{id}/receive': {
            put: {
                tags: ['Inbound'],
                summary: 'Receive inbound — on_the_way → completed',
                description: 'Atomic stock update: qty_on_hand increased, qty_inbound decreased, ledger entries written, combine SKUs recomputed.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object', required: ['lines'],
                                properties: {
                                    lines: {
                                        type: 'array', minItems: 1,
                                        items: {
                                            type: 'object', required: ['lineId', 'qtyReceived'],
                                            properties: {
                                                lineId: { type: 'integer', example: 1 },
                                                qtyReceived: { type: 'integer', example: 98, description: '0 = not received, partial allowed' },
                                                discrepancyNotes: { type: 'string', example: '2 units damaged' },
                                            },
                                        },
                                    },
                                    notes: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Completed — stock updated atomically' },
                    400: { description: 'Wrong status or missing stock record' },
                },
            },
        },
        '/inbound/{id}/cancel': {
            put: {
                tags: ['Inbound'], summary: 'Cancel inbound order',
                description: 'Cancels draft or on_the_way orders. Reverses qty_inbound if already shipped.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Cancelled successfully' }, 400: { description: 'Cannot cancel completed order' } },
            },
        },
    },
};