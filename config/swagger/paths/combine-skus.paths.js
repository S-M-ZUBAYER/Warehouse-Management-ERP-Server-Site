module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
        CombineSkuResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                warehouse_id: { type: 'integer', nullable: true, example: 1 },
                combine_name: { type: 'string', example: 'Gaming Bundle' },
                combine_sku_code: { type: 'string', example: 'COMBO-001' },
                gtin: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true, example: 'Complete gaming setup bundle' },
                selling_price: { type: 'number', format: 'float', nullable: true, example: 199.99 },
                cost_price: { type: 'number', format: 'float', nullable: true, example: 120.00 },
                weight: { type: 'number', format: 'float', nullable: true, example: 2.5 },
                length: { type: 'number', format: 'float', nullable: true, example: 30 },
                width: { type: 'number', format: 'float', nullable: true, example: 20 },
                height: { type: 'number', format: 'float', nullable: true, example: 10 },
                image_url: { type: 'string', nullable: true },
                status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
                warehouse: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        code: { type: 'string' },
                    },
                },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            quantity: { type: 'integer', example: 2 },
                            merchantSku: {
                                type: 'object',
                                properties: {
                                    id: { type: 'integer' },
                                    sku_name: { type: 'string' },
                                    sku_title: { type: 'string' },
                                    image_url: { type: 'string', nullable: true },
                                    price: { type: 'number', format: 'float' },
                                },
                            },
                        },
                    },
                },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
            },
        },

        CreateCombineSkuRequest: {
            type: 'object',
            required: ['combineName', 'combineSkuCode', 'items'],
            properties: {
                combineName: { type: 'string', minLength: 2, maxLength: 255, example: 'Gaming Bundle', description: 'Display name' },
                combineSkuCode: { type: 'string', minLength: 1, maxLength: 100, example: 'COMBO-001', description: 'Unique code' },
                gtin: { type: 'string', maxLength: 50, example: '12345678901234' },
                description: { type: 'string', example: 'Complete gaming setup with mouse and keyboard' },
                sellingPrice: { type: 'number', format: 'float', example: 199.99 },
                costPrice: { type: 'number', format: 'float', example: 120.00 },
                weight: { type: 'number', format: 'float', example: 2.5 },
                length: { type: 'number', format: 'float', example: 30 },
                width: { type: 'number', format: 'float', example: 20 },
                height: { type: 'number', format: 'float', example: 10 },
                warehouseId: { type: 'integer', example: 1 },
                status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
                items: {
                    type: 'array',
                    minItems: 1,
                    example: [{ merchantSkuId: 1, quantity: 2 }, { merchantSkuId: 2, quantity: 1 }],
                    items: {
                        type: 'object',
                        required: ['merchantSkuId', 'quantity'],
                        properties: {
                            merchantSkuId: { type: 'integer', example: 1, description: 'Merchant SKU ID' },
                            quantity: { type: 'integer', minimum: 1, example: 2, description: 'Quantity in bundle' },
                        },
                    },
                },
            },
        },

        UpdateCombineSkuRequest: {
            type: 'object',
            properties: {
                combineName: { type: 'string', minLength: 2, maxLength: 255 },
                gtin: { type: 'string', maxLength: 50 },
                description: { type: 'string' },
                sellingPrice: { type: 'number', format: 'float' },
                costPrice: { type: 'number', format: 'float' },
                weight: { type: 'number', format: 'float' },
                length: { type: 'number', format: 'float' },
                width: { type: 'number', format: 'float' },
                height: { type: 'number', format: 'float' },
                warehouseId: { type: 'integer' },
                status: { type: 'string', enum: ['active', 'inactive'] },
                items: {
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'object',
                        properties: {
                            merchantSkuId: { type: 'integer' },
                            quantity: { type: 'integer', minimum: 1 },
                        },
                    },
                },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/combine-skus/picker': {
            get: {
                tags: ['Combine SKUs'],
                summary: 'Get merchant SKUs for picker',
                description: 'Returns active merchant SKUs for the left panel when creating/editing a Combine SKU. Includes inventory availability.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'search', schema: { type: 'string', example: 'wireless' }, description: 'Search by SKU name or title' },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, description: 'Items per page' },
                ],
                responses: {
                    200: {
                        description: 'Merchant SKUs fetched',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Merchant SKUs fetched' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'integer', example: 1 },
                                                    sku_name: { type: 'string', example: 'WM-001' },
                                                    sku_title: { type: 'string', example: 'Wireless Mouse' },
                                                    image_url: { type: 'string', nullable: true },
                                                    price: { type: 'number', example: 29.99 },
                                                    available_in_inventory: { type: 'integer', example: 150 },
                                                    warehouse: {
                                                        type: 'object',
                                                        properties: {
                                                            id: { type: 'integer', example: 1 },
                                                            name: { type: 'string', example: 'Main Warehouse' },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        pagination: { $ref: '#/components/schemas/PaginatedResponse/properties/pagination' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },

        '/combine-skus': {
            get: {
                tags: ['Combine SKUs'],
                summary: 'Get all combine SKUs',
                description: 'Returns paginated list of combine SKUs with their component items.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, description: 'Items per page' },
                    { in: 'query', name: 'search', schema: { type: 'string', example: 'bundle' }, description: 'Search by name or code' },
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer', example: 1 }, description: 'Filter by warehouse' },
                    { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'inactive'] }, description: 'Filter by status' },
                    { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['created_at', 'updated_at', 'combine_name'], default: 'created_at' }, description: 'Sort field' },
                    { in: 'query', name: 'sortOrder', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' }, description: 'Sort order' },
                ],
                responses: {
                    200: { description: 'Combine SKUs fetched successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'array', items: { $ref: '#/components/schemas/CombineSkuResponse' } }, pagination: { $ref: '#/components/schemas/PaginatedResponse/properties/pagination' } } } } } },
                    401: { description: 'Unauthorized' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            post: {
                tags: ['Combine SKUs'],
                summary: 'Create a new combine SKU',
                description: 'Creates a bundle SKU from multiple merchant SKUs. Accessible to owner, admin, and manager roles.',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCombineSkuRequest' } } } },
                responses: {
                    201: { description: 'Combine SKU created successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/CombineSkuResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    409: { description: 'Combine SKU code already exists' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },

        '/combine-skus/{id}': {
            get: {
                tags: ['Combine SKUs'],
                summary: 'Get combine SKU by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Combine SKU ID' }],
                responses: {
                    200: { description: 'Combine SKU fetched successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/CombineSkuResponse' } } } } } },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Combine SKU not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            put: {
                tags: ['Combine SKUs'],
                summary: 'Update combine SKU',
                description: 'Updates bundle SKU information and its component items. Accessible to owner, admin, and manager roles.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Combine SKU ID' }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateCombineSkuRequest' } } } },
                responses: {
                    200: { description: 'Combine SKU updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/CombineSkuResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    404: { description: 'Combine SKU not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            delete: {
                tags: ['Combine SKUs'],
                summary: 'Delete combine SKU (soft delete)',
                description: 'Soft deletes a combine SKU. Accessible to owner, admin, and manager roles.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Combine SKU ID' }],
                responses: {
                    200: { description: 'Combine SKU deleted successfully' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    404: { description: 'Combine SKU not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },
    },
};