module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
        WarehouseResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                company_id: { type: 'integer', example: 1 },
                name: { type: 'string', example: 'Main Warehouse' },
                code: { type: 'string', example: 'WH-001' },
                attribute: { type: 'string', enum: ['own_warehouse', 'third_party_warehouse'], example: 'own_warehouse' },
                manager_name: { type: 'string', example: 'John Doe', nullable: true },
                phone: { type: 'string', example: '+1234567890', nullable: true },
                location: { type: 'string', example: '123 Business Park, City', nullable: true },
                city: { type: 'string', example: 'Kuala Lumpur', nullable: true },
                country: { type: 'string', example: 'Malaysia', nullable: true },
                is_default: { type: 'boolean', example: false },
                status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
                total_sku: { type: 'integer', example: 150, description: 'Total SKUs in this warehouse' },
                created_at: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
                updated_at: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
            },
        },

        CreateWarehouseRequest: {
            type: 'object',
            required: ['name', 'attribute'],
            properties: {
                name: { type: 'string', minLength: 2, maxLength: 150, example: 'Main Warehouse', description: 'Warehouse name (unique within company)' },
                attribute: { type: 'string', enum: ['own_warehouse', 'third_party_warehouse'], description: 'Warehouse type' },
                managerName: { type: 'string', maxLength: 100, example: 'John Doe', description: 'Warehouse manager name' },
                phone: { type: 'string', maxLength: 30, example: '+1234567890', description: 'Contact phone number' },
                location: { type: 'string', maxLength: 500, example: '123 Business Park, KL', description: 'Full address' },
                city: { type: 'string', maxLength: 100, example: 'Kuala Lumpur', description: 'City' },
                country: { type: 'string', maxLength: 100, example: 'Malaysia', description: 'Country' },
                status: { type: 'string', enum: ['active', 'inactive'], default: 'active', description: 'Warehouse status' },
            },
        },

        UpdateWarehouseRequest: {
            type: 'object',
            properties: {
                name: { type: 'string', minLength: 2, maxLength: 150, example: 'Main Warehouse Updated' },
                attribute: { type: 'string', enum: ['own_warehouse', 'third_party_warehouse'] },
                managerName: { type: 'string', maxLength: 100, example: 'Jane Doe' },
                phone: { type: 'string', maxLength: 30, example: '+0987654321' },
                location: { type: 'string', maxLength: 500, example: '456 Business Ave' },
                city: { type: 'string', maxLength: 100, example: 'Selangor' },
                country: { type: 'string', maxLength: 100, example: 'Malaysia' },
                status: { type: 'string', enum: ['active', 'inactive'], example: 'inactive' },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/warehouses': {
            get: {
                tags: ['Warehouses'],
                summary: 'Get all warehouses for the company',
                description: 'Returns paginated list. Default warehouse is always first. Accessible to all authenticated users.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, maximum: 100, default: 1 }, description: 'Page number' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, description: 'Items per page' },
                    { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'inactive'] }, description: 'Filter by status' },
                    { in: 'query', name: 'attribute', schema: { type: 'string', enum: ['own_warehouse', 'third_party_warehouse'] }, description: 'Filter by type' },
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100, example: 'main' }, description: 'Search name, code, location' },
                ],
                responses: {
                    200: { description: 'Warehouses fetched successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'array', items: { $ref: '#/components/schemas/WarehouseResponse' } }, pagination: { $ref: '#/components/schemas/PaginatedResponse/properties/pagination' } } } } } },
                    401: { description: 'Unauthorized' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
            post: {
                tags: ['Warehouses'],
                summary: 'Create a new warehouse — owner/admin only',
                description: 'First warehouse created is automatically set as default. Code is auto-generated (WH-001, WH-002...).',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateWarehouseRequest' } } } },
                responses: {
                    201: { description: 'Warehouse created successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/WarehouseResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner/admin only' },
                    409: { description: 'Warehouse name already exists' },
                    429: { description: 'Rate limit exceeded' },
                },
            },
        },

        '/warehouses/{id}': {
            get: {
                tags: ['Warehouses'],
                summary: 'Get a specific warehouse by ID',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Warehouse ID' }],
                responses: {
                    200: { description: 'Warehouse fetched successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/WarehouseResponse' } } } } } },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Warehouse not found' },
                },
            },
            put: {
                tags: ['Warehouses'],
                summary: 'Update a warehouse — owner/admin only',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Warehouse ID' }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateWarehouseRequest' } } } },
                responses: {
                    200: { description: 'Warehouse updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/WarehouseResponse' } } } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner/admin only' },
                    404: { description: 'Warehouse not found' },
                    409: { description: 'Warehouse name already exists' },
                },
            },
            delete: {
                tags: ['Warehouses'],
                summary: 'Delete a warehouse — owner/admin only',
                description: 'Cannot delete default warehouse if other warehouses exist. Set another as default first.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Warehouse ID' }],
                responses: {
                    200: { description: 'Warehouse deleted successfully' },
                    400: { description: 'Cannot delete default warehouse', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner/admin only' },
                    404: { description: 'Warehouse not found' },
                },
            },
        },

        '/warehouses/{id}/set-default': {
            patch: {
                tags: ['Warehouses'],
                summary: 'Set warehouse as default — owner/admin only',
                description: 'Atomically unsets old default and sets new one in a single transaction.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Warehouse ID to set as default' }],
                responses: {
                    200: { description: 'Default warehouse updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/WarehouseResponse' } } } } } },
                    400: { description: 'Already default or inactive', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner/admin only' },
                    404: { description: 'Warehouse not found' },
                },
            },
        },
    },
};