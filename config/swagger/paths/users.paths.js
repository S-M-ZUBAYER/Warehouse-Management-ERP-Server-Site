module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
        CreateSubAccountRequest: {
            type: 'object',
            required: ['accountId', 'name', 'email', 'password', 'roleId', 'warehouseId'],
            properties: {
                accountId: { type: 'string', example: 'EMP-001' },
                name: { type: 'string', example: 'Jane Smith' },
                email: { type: 'string', example: 'jane@company.com' },
                password: { type: 'string', example: 'Secret123' },
                roleId: { type: 'integer', example: 2 },
                warehouseId: { type: 'integer', example: 1 },
                department: { type: 'string', example: 'Operations' },
                designation: { type: 'string', example: 'Warehouse Manager' },
                phone: { type: 'string', example: '+60123456789' },
                address: { type: 'string', example: 'Kuala Lumpur, MY' },
                avatar: { type: 'string', description: 'Base64 encoded image' },
                storePermissions: {
                    type: 'array',
                    example: [{ connectionId: 1, canView: true, canEdit: false }],
                    items: {
                        type: 'object',
                        properties: {
                            connectionId: { type: 'integer' },
                            canView: { type: 'boolean' },
                            canEdit: { type: 'boolean' },
                        },
                    },
                },
                warehousePermissions: {
                    type: 'array',
                    example: [{ warehouseId: 1, canView: true, canEdit: true }],
                    items: {
                        type: 'object',
                        properties: {
                            warehouseId: { type: 'integer' },
                            canView: { type: 'boolean' },
                            canEdit: { type: 'boolean' },
                        },
                    },
                },
            },
        },

        SubAccountResponse: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 5 },
                name: { type: 'string', example: 'Jane Smith' },
                email: { type: 'string', example: 'jane@co.com' },
                role: { type: 'string', example: 'manager' },
                accountId: { type: 'string', example: 'EMP-001' },
                department: { type: 'string', example: 'Operations' },
                designation: { type: 'string', example: 'WH Manager' },
                phone: { type: 'string', example: '+60123456789' },
                avatarUrl: { type: 'string', example: null },
                isActive: { type: 'boolean', example: true },
                companyId: { type: 'integer', example: 1 },
                roleInfo: { type: 'object', example: { id: 2, name: 'Manager' } },
                storePermissions: { type: 'array', items: { type: 'object' } },
                warehousePermissions: { type: 'array', items: { type: 'object' } },
            },
        },

        UpsertSubAccountRequest: {
            type: 'object',
            required: ['email'],
            description: `**Upsert** — single endpoint for create OR update.
- If **email does not exist** in the company → creates the sub account (accountId, name, password, roleId, warehouseId become required).
- If **email exists** → patches only the fields you provide (all fields optional except email).
- Email itself is always the lookup key and cannot be changed.
- Owner accounts can never be targeted via this endpoint.`,
            properties: {
                email: {
                    type: 'string', format: 'email', example: 'jane@company.com',
                    description: '**Required always** — used as the lookup key',
                },
                // ── Required on CREATE, optional on UPDATE ──────────────
                accountId: {
                    type: 'string', example: 'EMP-001',
                    description: 'Required on create. Must be unique within the company.',
                },
                name: {
                    type: 'string', minLength: 2, maxLength: 100, example: 'Jane Smith',
                    description: 'Required on create.',
                },
                password: {
                    type: 'string', minLength: 8, example: 'Secret123',
                    description: 'Required on create. Hashed server-side. Optional on update.',
                },
                roleId: {
                    type: 'integer', minimum: 1, example: 2,
                    description: 'Required on create. Must belong to the same company.',
                },
                warehouseId: {
                    type: 'integer', minimum: 1, example: 1,
                    description: 'Required on create. Must belong to the same company.',
                },
                // ── Always optional ─────────────────────────────────────
                department: { type: 'string', example: 'Operations' },
                designation: { type: 'string', example: 'Warehouse Manager' },
                phone: { type: 'string', example: '+60123456789' },
                address: { type: 'string', example: 'Kuala Lumpur, MY' },
                isActive: {
                    type: 'boolean', example: true,
                    description: 'Defaults to true on create. Setting false on update kills the user Redis session immediately.',
                },
                avatar: { type: 'string', example: 'Base64 encoded JPEG/PNG image.' },
                storePermissions: {
                    type: 'array',
                    description: 'Full replace on update — omit to leave unchanged, send [] to clear all.',
                    example: [{ connectionId: 1, canView: true, canEdit: false }],
                    items: {
                        type: 'object',
                        required: ['connectionId'],
                        properties: {
                            connectionId: { type: 'integer', minimum: 1 },
                            canView: { type: 'boolean', default: true },
                            canEdit: { type: 'boolean', default: false },
                        },
                    },
                },
                warehousePermissions: {
                    type: 'array',
                    description: 'Full replace on update — omit to leave unchanged, send [] to clear all.',
                    example: [{ warehouseId: 1, canView: true, canEdit: true }],
                    items: {
                        type: 'object',
                        required: ['warehouseId'],
                        properties: {
                            warehouseId: { type: 'integer', minimum: 1 },
                            canView: { type: 'boolean', default: true },
                            canEdit: { type: 'boolean', default: false },
                        },
                    },
                },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/users': {
            get: {
                tags: ['Users'],
                summary: 'Get all sub accounts for the company (paginated)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, description: 'Items per page' },
                    { in: 'query', name: 'search', schema: { type: 'string', example: 'Jane' }, description: 'Search by name, email, account ID' },
                    { in: 'query', name: 'roleId', schema: { type: 'integer', example: 2 }, description: 'Filter by role ID' },
                    { in: 'query', name: 'isActive', schema: { type: 'boolean', example: true }, description: 'Filter by status' },
                ],
                responses: {
                    200: { description: 'Sub accounts list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } },
                    401: { description: 'Unauthorized' },
                },
            },
            post: {
                tags: ['Users'],
                summary: 'Create a sub account — owner/admin only',
                description: 'Creates sub account with store and warehouse permissions. Avatar accepted as base64.',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSubAccountRequest' } } } },
                responses: {
                    201: { description: 'Sub account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SubAccountResponse' } } } },
                    400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    403: { description: 'Permission denied — owner/admin role required' },
                    409: { description: 'Email or Account ID already in use' },
                },
            },
        },

        '/users/{id}': {
            get: {
                tags: ['Users'],
                summary: 'Get a specific sub account (with permissions)',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 5 }, description: 'User ID' }],
                responses: {
                    200: { description: 'Sub account details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SubAccountResponse' } } } },
                    401: { description: 'Unauthorized' },
                    404: { description: 'User not found' },
                },
            },
            put: {
                tags: ['Users'],
                summary: 'Update a sub account — owner/admin only',
                description: 'All fields optional. Providing storePermissions or warehousePermissions replaces them entirely.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 5 } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    roleId: { type: 'integer' },
                                    department: { type: 'string' },
                                    designation: { type: 'string' },
                                    phone: { type: 'string' },
                                    address: { type: 'string' },
                                    isActive: { type: 'boolean' },
                                    avatar: { type: 'string', description: 'Base64 image' },
                                    storePermissions: { type: 'array', items: { type: 'object' } },
                                    warehousePermissions: { type: 'array', items: { type: 'object' } },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/SubAccountResponse' } } } },
                    400: { description: 'Validation error' },
                    403: { description: 'Permission denied' },
                    404: { description: 'User not found' },
                },
            },
            delete: {
                tags: ['Users'],
                summary: 'Delete a sub account — owner/admin only',
                description: 'Hard deletes the user and immediately kills their Redis session.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 5 } }],
                responses: {
                    200: { description: 'Deleted successfully' },
                    403: { description: 'Permission denied' },
                    404: { description: 'User not found' },
                },
            },
        },

        '/users/upsert': {
            post: {
                tags: ['Users'],
                summary: 'Upsert sub account — create or update by email in body',
                description: `Checks if **email** (from request body) exists in the company.
- **Not found** → creates new sub account (accountId, name, password, roleId, warehouseId required)
- **Found** → updates only the fields provided`,
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UpsertSubAccountRequest' },
                            examples: {
                                createNew: {
                                    summary: '🆕 Create — email not in DB',
                                    value: {
                                        email: 'jane@company.com',
                                        accountId: 'EMP-001',
                                        name: 'Jane Smith',
                                        password: 'Secret123',
                                        roleId: 2,
                                        warehouseId: 1,
                                        department: 'Operations',
                                        designation: 'Warehouse Manager',
                                        phone: '+60123456789',
                                        avatar: 'Base64_String',
                                        storePermissions: [{ connectionId: 1, canView: true, canEdit: false }],
                                        warehousePermissions: [{ warehouseId: 1, canView: true, canEdit: true }],
                                    },
                                },
                                updateAny: {
                                    summary: '✏️ Update — email exists in DB',
                                    value: {
                                        email: 'jane@company.com',
                                        name: 'Jane Johnson',
                                        roleId: 3,
                                        department: 'Logistics',
                                        isActive: true,
                                        storePermissions: [{ connectionId: 1, canView: true, canEdit: true }],
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Created — email was not found, new sub account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SubAccountResponse' } } } },
                    200: { description: 'Updated — email found, sub account patched', content: { 'application/json': { schema: { $ref: '#/components/schemas/SubAccountResponse' } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    403: { description: 'Permission denied — owner/admin role required' },
                    409: { description: 'accountId already in use within this company' },
                },
            },
        },
    },
};