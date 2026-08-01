const shipmentStatuses = ['Processed', 'On The Way', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];

module.exports = {
    schemas: {
        PlatformManualOrderLogistic: {
            type: 'object',
            properties: {
                trackingNumber: { type: 'string', example: 'SPXMY123456789' },
                deliveryCompany: { type: 'string', example: 'Shopee Xpress' },
            },
        },
        PlatformManualOrderAddress: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'John Doe' },
                company: { type: 'string', example: 'Grozziie' },
                phone: { type: 'string', example: '+60123456789' },
                email: { type: 'string', example: 'buyer@example.com' },
                address: { type: 'string', example: '123 Jalan Example' },
                country: { type: 'string', example: 'Malaysia' },
                state: { type: 'string', example: 'Selangor' },
                city: { type: 'string', example: 'Petaling Jaya' },
                area: { type: 'string', example: 'Damansara' },
                zipCode: { type: 'string', example: '47800' },
                unit: { type: 'string', example: 'A-10-01' },
            },
        },
        PlatformManualOrderProduct: {
            type: 'object',
            required: ['id', 'qty'],
            description: 'Provide exactly one of merchantSkuId or combineSkuId.',
            properties: {
                id: { type: 'string', example: 'merchant:334', description: 'Stable frontend row ID' },
                merchantSkuId: { type: 'string', nullable: true, example: '334' },
                combineSkuId: { type: 'string', nullable: true, example: null },
                skuType: { type: 'string', enum: ['merchant', 'combine'], example: 'merchant' },
                sku: { type: 'string', example: 'PUNCHCARD' },
                name: { type: 'string', example: 'Punch Card' },
                qty: { type: 'number', example: 2 },
                unitPrice: { type: 'number', example: 499 },
                weight: { type: 'number', example: 0.2 },
            },
        },
        PlatformManualOrderPackage: {
            type: 'object',
            properties: {
                weight: { type: 'string', example: '1.2' },
                length: { type: 'string', example: '10' },
                width: { type: 'string', example: '8' },
                height: { type: 'string', example: '5' },
            },
        },
        PlatformManualOrder: {
            type: 'object',
            properties: {
                id: { type: 'string', example: '1' },
                warehouseId: { type: 'string', example: '3' },
                orderNumber: { type: 'string', example: 'PMO-10001' },
                orderTime: { type: 'string', example: '14:30' },
                orderDate: { type: 'string', format: 'date', example: '2026-07-16' },
                waybillFileName: { type: 'string', example: 'waybill.pdf' },
                waybillUrl: { type: 'string', example: '/uploads/platform-manual-waybills/1720000000-waybill.pdf' },
                shipmentStatus: { type: 'string', enum: shipmentStatuses, example: 'Processed' },
                logistic: { $ref: '#/components/schemas/PlatformManualOrderLogistic' },
                sender: { $ref: '#/components/schemas/PlatformManualOrderAddress' },
                buyer: { $ref: '#/components/schemas/PlatformManualOrderAddress' },
                products: { type: 'array', items: { $ref: '#/components/schemas/PlatformManualOrderProduct' } },
                package: { $ref: '#/components/schemas/PlatformManualOrderPackage' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        },
        PlatformManualWarehouseOption: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'WH-004' },
                name: { type: 'string', example: 'Grozziie' },
                code: { type: 'string', example: 'WH-004' },
                warehouseId: { type: 'string', example: '3' },
            },
        },
        PlatformManualSkuOption: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'merchant:334' },
                merchantSkuId: { type: 'string', nullable: true, example: '334' },
                combineSkuId: { type: 'string', nullable: true, example: null },
                skuType: { type: 'string', enum: ['merchant', 'combine'], example: 'merchant' },
                sku: { type: 'string', example: 'PUNCHCARD' },
                name: { type: 'string', example: 'Punch Card' },
                image: { type: 'string', example: 'https://cdn.example.com/image.jpg' },
                availableForPlatform: { type: 'number', example: 74 },
                unitPrice: { type: 'number', example: 499 },
                weight: { type: 'number', example: 0.2 },
            },
        },
    },
    paths: {
        '/platform-manual-orders': {
            get: {
                tags: ['Platform Manual Orders'],
                summary: 'List platform manual orders',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'companyId', required: true, schema: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
                    { in: 'query', name: 'warehouseId', schema: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
                    { in: 'query', name: 'statuses', schema: { type: 'array', items: { type: 'string', enum: shipmentStatuses } }, style: 'form', explode: true },
                    { in: 'query', name: 'searchType', schema: { type: 'string', enum: ['Single Search', 'Batch Search'] } },
                    { in: 'query', name: 'searchField', schema: { type: 'string', enum: ['SKU', 'Order Number'] } },
                    { in: 'query', name: 'searchValues', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 } },
                ],
                responses: {
                    200: {
                        description: 'Platform manual orders fetched',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        orders: { type: 'array', items: { $ref: '#/components/schemas/PlatformManualOrder' } },
                                        total: { type: 'integer', example: 1 },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Platform Manual Orders'],
                summary: 'Create a platform manual order',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['warehouseId', 'orderNumber', 'orderTime', 'orderDate', 'waybillFile', 'logistic', 'sender', 'buyer', 'products'],
                                properties: {
                                    warehouseId: { type: 'string', example: '3' },
                                    orderNumber: { type: 'string', example: 'PMO-10001' },
                                    orderTime: { type: 'string', example: '14:30' },
                                    orderDate: { type: 'string', format: 'date', example: '2026-07-16' },
                                    waybillFile: { type: 'string', format: 'binary' },
                                    logistic: { type: 'string', example: '{"trackingNumber":"SPXMY123456789","deliveryCompany":"Shopee Xpress"}' },
                                    sender: { type: 'string', example: '{"name":"Warehouse","phone":"+60123456789","address":"Sender address","country":"Malaysia","state":"Selangor","city":"Petaling Jaya","zipCode":"47800"}' },
                                    buyer: { type: 'string', example: '{"name":"Buyer","phone":"+60123456789","email":"buyer@example.com","address":"Buyer address","country":"Malaysia","state":"Selangor","city":"Petaling Jaya","area":"","zipCode":"47800","unit":""}' },
                                    products: { type: 'string', example: '[{"id":"merchant:334","merchantSkuId":"334","sku":"PUNCHCARD","name":"Punch Card","qty":2,"unitPrice":499,"weight":0.2}]' },
                                    package: { type: 'string', example: '{"weight":"1.2","length":"10","width":"8","height":"5"}' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformManualOrder' } } } },
                    400: { description: 'Validation failed' },
                },
            },
        },
        '/platform-manual-orders/{id}': {
            put: {
                tags: ['Platform Manual Orders'],
                summary: 'Update a platform manual order',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: [],
                                description: 'Updates editable fields only. Existing warehouse, sender information, and product lines are preserved.',
                                properties: {
                                    warehouseId: { type: 'string', example: '3', readOnly: true, description: 'Ignored on update. Existing warehouse is kept.' },
                                    orderNumber: { type: 'string', example: 'PMO-10001' },
                                    orderTime: { type: 'string', example: '14:30' },
                                    orderDate: { type: 'string', format: 'date', example: '2026-07-16' },
                                    waybillFile: { type: 'string', format: 'binary', description: 'Optional. Existing waybill is kept when omitted.' },
                                    logistic: { type: 'string', example: '{"trackingNumber":"SPXMY123456789","deliveryCompany":"Shopee Xpress"}' },
                                    sender: { type: 'string', readOnly: true, description: 'Ignored on update. Existing sender information is kept.', example: '{"name":"Warehouse","phone":"+60123456789","address":"Sender address","country":"Malaysia","state":"Selangor","city":"Petaling Jaya","zipCode":"47800"}' },
                                    buyer: { type: 'string', example: '{"name":"Buyer","phone":"+60123456789","email":"buyer@example.com","address":"Buyer address","country":"Malaysia","state":"Selangor","city":"Petaling Jaya","area":"","zipCode":"47800","unit":""}' },
                                    products: { type: 'string', readOnly: true, description: 'Ignored on update. Existing product lines and quantities are kept.', example: '[{"id":"merchant:334","merchantSkuId":"334","sku":"PUNCHCARD","name":"Punch Card","qty":2,"unitPrice":499,"weight":0.2}]' },
                                    package: { type: 'string', example: '{"weight":"1.2","length":"10","width":"8","height":"5"}' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformManualOrder' } } } },
                },
            },
            delete: {
                tags: ['Platform Manual Orders'],
                summary: 'Delete a platform manual order',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: {
                    200: {
                        description: 'Deleted',
                        content: { 'application/json': { schema: { type: 'object', properties: { deleted: { type: 'boolean', example: true } } } } },
                    },
                },
            },
        },
        '/platform-manual-orders/{id}/status': {
            patch: {
                tags: ['Platform Manual Orders'],
                summary: 'Update platform manual order shipment status',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['shipmentStatus'],
                                properties: {
                                    shipmentStatus: { type: 'string', enum: shipmentStatuses, example: 'Processed' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Status updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformManualOrder' } } } },
                    400: { description: 'Invalid shipment status' },
                },
            },
        },
        '/warehouses/{warehouseId}/merchant-skus': {
            get: {
                tags: ['Platform Manual Orders'],
                summary: 'List merchant SKUs available in a warehouse',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'warehouseId', required: true, schema: { type: 'string' } },
                    { in: 'query', name: 'companyId', schema: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
                    { in: 'query', name: 'search', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'SKU options', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PlatformManualSkuOption' } } } } },
                },
            },
        },
    },
};


