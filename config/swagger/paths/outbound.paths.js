module.exports = {
    schemas: {
        OutboundOrderResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                warehouse_id: { type: 'integer', example: 1 },
                outbound_id: { type: 'string', example: 'OB-2026-000001' },
                status: { type: 'string', enum: ['draft', 'on_the_way', 'completed'], example: 'draft' },
                supplier_name: { type: 'string', nullable: true, example: 'Acme Supplies Ltd' },
                supplier_reference: { type: 'string', nullable: true, example: 'PO-001' },
                receiving_warehouse_name: { type: 'string', nullable: true, example: 'Main Warehouse' },
                receiving_warehouse_address: { type: 'string', nullable: true, example: '123 Warehouse Road, Kuala Lumpur' },
                tracking_number: { type: 'string', nullable: true, example: 'TRK-ABC123' },
                purchase_currency: { type: 'string', nullable: true, example: 'USD' },
                exchange_rate: { type: 'number', nullable: true, example: 4.65 },
                shipping_cost: { type: 'number', nullable: true, example: 25.50 },
                notes: { type: 'string', nullable: true },
                estimated_arrival: { type: 'string', format: 'date', nullable: true, example: '2026-08-15' },
                shipped_at: { type: 'string', format: 'date-time', nullable: true },
                arrived_at: { type: 'string', format: 'date-time', nullable: true },
                warehouse: {
                    type: 'object', nullable: true,
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Main Warehouse' },
                        code: { type: 'string', example: 'WH-001' },
                        location: { type: 'string', nullable: true, example: '123 Warehouse Road' },
                        city: { type: 'string', nullable: true, example: 'Kuala Lumpur' },
                        country: { type: 'string', nullable: true, example: 'Malaysia' },
                    },
                },
                lines: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer', example: 1 },
                            merchant_sku_id: { type: 'integer', example: 1 },
                            qty_expected: { type: 'integer', example: 10 },
                            qty_received: { type: 'integer', example: 0 },
                            has_discrepancy: { type: 'boolean', example: false },
                            discrepancy_notes: { type: 'string', nullable: true },
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
        '/outbound/dropdowns': {
            get: {
                tags: ['Outbound'],
                summary: 'Get dropdowns for outbound forms',
                description: 'Returns active warehouses with address/location data and supported currencies.',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Dropdowns fetched' } },
            },
        },
        '/outbound/picker': {
            get: {
                tags: ['Outbound'],
                summary: 'SKU picker for outbound lines',
                description: 'Returns active merchant SKUs for the selected warehouse with current available stock. Outbound quantities must not exceed qty_available.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' }, description: 'Required by the frontend before selecting SKUs' },
                    { in: 'query', name: 'search', schema: { type: 'string' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                ],
                responses: { 200: { description: 'SKUs fetched with stock levels' } },
            },
        },
        '/outbound': {
            get: {
                tags: ['Outbound'],
                summary: 'List outbound orders',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'status', schema: { type: 'string', enum: ['draft', 'on_the_way', 'completed', 'all'] } },
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' } },
                    { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by outbound_id, tracking, or notes' },
                    { in: 'query', name: 'dateFrom', schema: { type: 'string', format: 'date' } },
                    { in: 'query', name: 'dateTo', schema: { type: 'string', format: 'date' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
                    { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['created_at', 'updated_at', 'estimated_arrival', 'outbound_id'] } },
                    { in: 'query', name: 'sortOrder', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
                ],
                responses: { 200: { description: 'Outbound orders fetched', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/OutboundOrderResponse' } } } } } } } },
            },
            post: {
                tags: ['Outbound'],
                summary: 'Create draft outbound order',
                description: 'Creates a draft only. Inventory and mapping quantities are not changed at this stage.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['warehouseId', 'receivingWarehouseName', 'receivingWarehouseAddress', 'lines'],
                                properties: {
                                    warehouseId: { type: 'integer', example: 1 },
                                    supplierName: { type: 'string', example: 'Acme Supplies' },
                                    supplierReference: { type: 'string', example: 'PO-001' },
                                    receivingWarehouseName: { type: 'string', example: 'Main Warehouse' },
                                    receivingWarehouseAddress: { type: 'string', example: '123 Warehouse Road, Kuala Lumpur' },
                                    notes: { type: 'string' },
                                    lines: {
                                        type: 'array', minItems: 1,
                                        items: {
                                            type: 'object', required: ['merchantSkuId', 'qtyExpected'],
                                            properties: {
                                                merchantSkuId: { type: 'integer', example: 1 },
                                                qtyExpected: { type: 'integer', example: 10, description: 'Must not exceed available inventory in the selected warehouse' },
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
                responses: { 201: { description: 'Outbound draft created' }, 400: { description: 'Validation failed or insufficient available stock' } },
            },
        },
        '/outbound/{id}': {
            get: {
                tags: ['Outbound'], summary: 'Get outbound order by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Outbound order detail' }, 404: { description: 'Not found' } },
            },
            put: {
                tags: ['Outbound'], summary: 'Update draft outbound order',
                description: 'Only draft outbound orders can be edited. The outbound ID and selected warehouse cannot be changed.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['receivingWarehouseName', 'receivingWarehouseAddress'], properties: { supplierName: { type: 'string' }, supplierReference: { type: 'string' }, receivingWarehouseName: { type: 'string' }, receivingWarehouseAddress: { type: 'string' }, notes: { type: 'string' }, lines: { type: 'array', items: { type: 'object', required: ['merchantSkuId', 'qtyExpected'], properties: { merchantSkuId: { type: 'integer' }, qtyExpected: { type: 'integer' }, unitCost: { type: 'number' }, currency: { type: 'string' } } } } } } } } },
                responses: { 200: { description: 'Outbound draft updated' }, 400: { description: 'Cannot edit non-draft outbound or quantity exceeds available stock' } },
            },
            delete: {
                tags: ['Outbound'], summary: 'Delete draft outbound order',
                description: 'Only draft outbound orders can be deleted. No stock is changed because draft creation does not affect stock.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Outbound draft deleted' }, 400: { description: 'Cannot delete non-draft outbound' } },
            },
        },
        '/outbound/{id}/ship': {
            put: {
                tags: ['Outbound'],
                summary: 'Ship outbound - draft to on_the_way',
                description: 'Final confirmation step. Deducts qty_on_hand from inventory, writes stock ledger transfer_out entries, reduces directly mapped Shopee/TikTok platform stock by the outbound quantity using platform reduce-stock APIs, recomputes related combine SKUs/mappings, then moves the outbound to on_the_way. After this the outbound cannot be edited or deleted.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['trackingNumber', 'purchaseCurrency', 'estimatedArrival'], properties: { trackingNumber: { type: 'string', example: 'TRK-ABC123' }, purchaseCurrency: { type: 'string', example: 'USD' }, estimatedArrival: { type: 'string', format: 'date', example: '2026-08-15' }, exchangeRate: { type: 'number', example: 4.65 }, shippingCost: { type: 'number', example: 25.50 }, notes: { type: 'string' } } } } } },
                responses: { 200: { description: 'Outbound shipped and inventory reduced' }, 400: { description: 'Wrong status or insufficient available stock' } },
            },
        },
        '/outbound/{id}/receive': {
            put: {
                tags: ['Outbound'],
                summary: 'Receive outbound - on_the_way to completed',
                description: 'Records actual received quantities and discrepancy notes, then marks the outbound completed. This does not add stock back; stock was already deducted at ship time.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['lines'], properties: { lines: { type: 'array', minItems: 1, items: { type: 'object', required: ['lineId', 'qtyReceived'], properties: { lineId: { type: 'integer', example: 1 }, qtyReceived: { type: 'integer', example: 9 }, discrepancyNotes: { type: 'string', example: '1 unit short' } } } }, notes: { type: 'string' } } } } } },
                responses: { 200: { description: 'Outbound completed' }, 400: { description: 'Wrong status or invalid line IDs' } },
            },
        },
    },
};
