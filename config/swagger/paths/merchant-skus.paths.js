module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
        MerchantSkuResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                warehouse_id: { type: 'integer', nullable: true, example: 1 },
                sku_name: { type: 'string', example: 'WM-001' },
                sku_title: { type: 'string', example: 'Wireless Mouse' },
                gtin: { type: 'string', nullable: true, example: '12345678901234' },
                product_details: { type: 'string', nullable: true, example: 'Ergonomic wireless mouse with 3 buttons' },
                weight: { type: 'number', format: 'float', nullable: true, example: 0.25 },
                length: { type: 'number', format: 'float', nullable: true, example: 10 },
                width: { type: 'number', format: 'float', nullable: true, example: 6 },
                height: { type: 'number', format: 'float', nullable: true, example: 3 },
                price: { type: 'number', format: 'float', nullable: true, example: 29.99 },
                cost_price: { type: 'number', format: 'float', nullable: true, example: 15.50 },
                image_url: { type: 'string', nullable: true },
                country: { type: 'string', nullable: true, example: 'Malaysia' },
                status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
                available_in_inventory: { type: 'integer', example: 150, description: 'Available stock count' },
                in_transit_inventory: { type: 'integer', example: 50, description: 'In-transit stock count' },
                warehouse: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Main Warehouse' },
                        code: { type: 'string', example: 'WH-001' },
                    },
                },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
            },
        },

        CreateMerchantSkuRequest: {
            type: 'object',
            required: ['skuName', 'skuTitle'],
            properties: {
                skuName: { type: 'string', minLength: 1, maxLength: 100, example: 'WM-001', description: 'Unique SKU code' },
                skuTitle: { type: 'string', minLength: 2, maxLength: 255, example: 'Wireless Mouse', description: 'Display name' },
                warehouseId: { type: 'integer', example: 1, description: 'Warehouse ID' },
                gtin: { type: 'string', maxLength: 50, example: '12345678901234', description: 'Global Trade Item Number' },
                productDetails: { type: 'string', example: 'Ergonomic wireless mouse', description: 'Detailed description' },
                weight: { type: 'number', format: 'float', example: 0.25, description: 'Weight in kg' },
                length: { type: 'number', format: 'float', example: 10, description: 'Length in cm' },
                width: { type: 'number', format: 'float', example: 6, description: 'Width in cm' },
                height: { type: 'number', format: 'float', example: 3, description: 'Height in cm' },
                price: { type: 'number', format: 'float', example: 29.99, description: 'Selling price' },
                costPrice: { type: 'number', format: 'float', example: 15.50, description: 'Cost price' },
                country: { type: 'string', maxLength: 100, example: 'Malaysia', description: 'Country of origin' },
                status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
                image: { type: 'string', description: 'Base64 encoded image' },
            },
        },

        UpdateMerchantSkuRequest: {
            type: 'object',
            properties: {
                skuTitle: { type: 'string', minLength: 2, maxLength: 255, example: 'Wireless Mouse Pro' },
                warehouseId: { type: 'integer', example: 2 },
                gtin: { type: 'string', maxLength: 50 },
                productDetails: { type: 'string' },
                weight: { type: 'number', format: 'float' },
                length: { type: 'number', format: 'float' },
                width: { type: 'number', format: 'float' },
                height: { type: 'number', format: 'float' },
                price: { type: 'number', format: 'float' },
                costPrice: { type: 'number', format: 'float' },
                country: { type: 'string', maxLength: 100 },
                status: { type: 'string', enum: ['active', 'inactive'] },
                image: { type: 'string', description: 'Base64 encoded image' },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/merchant-skus/dropdowns': {
            get: {
                tags: ['Merchant SKUs'],
                summary: 'Get dropdown data for filters',
                description: 'Returns warehouses and countries for filter dropdowns in the product list page.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Dropdowns fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Dropdowns fetched' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                warehouses: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            id: { type: 'integer', example: 1 },
                                                            name: { type: 'string', example: 'Main Warehouse' },
                                                            code: { type: 'string', example: 'WH-001' },
                                                            is_default: { type: 'boolean', example: true },
                                                        },
                                                    },
                                                },
                                                countries: { type: 'array', items: { type: 'string', example: 'Malaysia' } },
                                            },
                                        },
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

        '/merchant-skus': {
            get: {
                tags: ['Merchant SKUs'],
                summary: 'Get all merchant SKUs (products)',
                description: 'Returns paginated list of merchant SKUs with inventory counts. Supports filtering by warehouse, status, country, and search.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, description: 'Items per page' },
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100, example: 'wireless' }, description: 'Search by SKU name or title' },
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer', example: 1 }, description: 'Filter by warehouse ID' },
                    { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'inactive', 'all', 'in_stock', 'out_of_stock'], default: 'all' }, description: 'Filter by status or stock level' },
                    { in: 'query', name: 'country', schema: { type: 'string', example: 'Malaysia' }, description: 'Filter by country' },
                    { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['created_at', 'updated_at', 'sku_name', 'sku_title'], default: 'created_at' }, description: 'Sort field' },
                    { in: 'query', name: 'sortOrder', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' }, description: 'Sort order' },
                ],
                responses: {
                    200: { description: 'Products fetched successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'array', items: { $ref: '#/components/schemas/MerchantSkuResponse' } }, pagination: { $ref: '#/components/schemas/PaginatedResponse/properties/pagination' } } } } } },
                    401: { description: 'Unauthorized' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            post: {
                tags: ['Merchant SKUs'],
                summary: 'Create a new merchant SKU',
                description: 'Creates a new product/SKU. Accessible to owner, admin, and manager roles.',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateMerchantSkuRequest' } } } },
                responses: {
                    201: { description: 'Product created successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/MerchantSkuResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    409: { description: 'SKU name already exists' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },

        '/merchant-skus/{id}': {
            get: {
                tags: ['Merchant SKUs'],
                summary: 'Get merchant SKU by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Merchant SKU ID' }],
                responses: {
                    200: { description: 'Product fetched successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/MerchantSkuResponse' } } } } } },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Merchant SKU not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            put: {
                tags: ['Merchant SKUs'],
                summary: 'Update merchant SKU',
                description: 'Updates product/SKU information. Accessible to owner, admin, and manager roles.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Merchant SKU ID' }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateMerchantSkuRequest' } } } },
                responses: {
                    200: { description: 'Product updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/MerchantSkuResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    404: { description: 'Merchant SKU not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            delete: {
                tags: ['Merchant SKUs'],
                summary: 'Delete merchant SKU (soft delete)',
                description: 'Soft deletes a merchant SKU. Cannot delete if used in any Combine SKU.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Merchant SKU ID' }],
                responses: {
                    200: { description: 'Product deleted successfully' },
                    400: { description: 'Cannot delete — SKU used in Combine SKU(s)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    404: { description: 'Merchant SKU not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },

        '/merchant-skus/bulk': {
            delete: {
                tags: ['Merchant SKUs'],
                summary: 'Bulk delete merchant SKUs',
                description: 'Soft deletes multiple merchant SKUs at once. Cannot delete SKUs used in Combine SKUs.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['skuIds'],
                                properties: {
                                    skuIds: {
                                        type: 'array',
                                        items: { type: 'integer', example: 1 },
                                        description: 'Array of merchant SKU IDs to delete',
                                        example: [1, 2, 3],
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Products deleted successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: '3 product(s) deleted successfully' }, data: { type: 'object', properties: { deleted: { type: 'integer', example: 3 } } } } } } } },
                    400: { description: 'Validation failed or SKUs used in Combine SKUs', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — requires owner/admin/manager role' },
                    404: { description: 'One or more SKUs not found' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },
    },
};