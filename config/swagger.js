const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: `${process.env.APP_NAME || 'Grozziie ERP'} API`,
            version: '1.0.0',
            description: 'Warehouse & Order Management ERP — REST API Documentation',
            contact: {
                name: 'S M Zubayer, Full Stack Developer',
                email: 'smzubayer9004@gmail.com',
            },
        },
        servers: [
            {
                url: `${process.env.APP_URL || 'http://localhost:5000'}/api/v1`,
                description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token. Get it from POST /auth/login',
                },
            },
            schemas: {

                // ── Generic responses ─────────────────────────────────────────
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Operation successful' },
                        data: { type: 'object' },
                    },
                },
                PaginatedResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: { type: 'array', items: {} },
                        pagination: {
                            type: 'object',
                            properties: {
                                total: { type: 'integer', example: 100 },
                                page: { type: 'integer', example: 1 },
                                limit: { type: 'integer', example: 20 },
                                totalPages: { type: 'integer', example: 5 },
                            },
                        },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Validation failed' },
                        errors: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    field: { type: 'string' },
                                    message: { type: 'string' },
                                },
                            },
                        },
                    },
                },

                // ── Auth ──────────────────────────────────────────────────────
                RegisterRequest: {
                    type: 'object',
                    required: ['userName', 'userEmail', 'userPassword'],
                    properties: {
                        userName: { type: 'string', example: 'John Doe' },
                        userEmail: { type: 'string', example: 'john@company.com' },
                        userPassword: { type: 'string', example: 'Secret123' },
                        companyName: { type: 'string', example: 'Acme Corp' },
                        phone: { type: 'string', example: '+60123456789' },
                        timezone: { type: 'string', example: 'Asia/Kuala_Lumpur' },
                        currency: { type: 'string', example: 'MYR' },
                        avatar: { type: 'string', description: 'Base64 encoded image (JPEG/PNG)' },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', example: 'john@company.com' },
                        password: { type: 'string', example: 'Secret123' },
                    },
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Login successful' },
                        data: {
                            type: 'object',
                            properties: {
                                accessToken: { type: 'string', example: 'eyJhbGci...' },
                                refreshToken: { type: 'string', example: 'eyJhbGci...' },
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'integer', example: 1 },
                                        name: { type: 'string', example: 'John Doe' },
                                        email: { type: 'string', example: 'john@co.com' },
                                        role: { type: 'string', enum: ['owner', 'admin', 'manager', 'staff', 'viewer'] },
                                        accountId: { type: 'string', example: 'ADM-000001' },
                                        avatarUrl: { type: 'string', example: null },
                                        companyId: { type: 'integer', example: 1 },
                                        companyName: { type: 'string', example: 'Acme Corp' },
                                        companySlug: { type: 'string', example: 'acme-corp-ab12cd34' },
                                        plan: { type: 'string', example: 'trial' },
                                        trialEndsAt: { type: 'string', example: '2025-04-14' },
                                    },
                                },
                            },
                        },
                    },
                },

                // ── Sub Account ───────────────────────────────────────────────
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


                // ── Roles ─────────────────────────────────────────────────────
                RoleResponse: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 3 },
                        company_id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Digital Marketer' },
                        description: { type: 'string', example: 'Handles marketing tasks', nullable: true },
                        permissions: { type: 'object', description: 'Page-level permission map' },
                        sub_account_linking_status: { type: 'string', enum: ['linked', 'not_linked'], example: 'linked' },
                        user_count: { type: 'integer', example: 3, description: 'Number of sub accounts using this role' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                    },
                },
                CreateRoleRequest: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string', minLength: 2, maxLength: 100, example: 'Digital Marketer' },
                        description: { type: 'string', maxLength: 500, example: 'Handles all marketing tasks' },
                        subAccountLinkingStatus: { type: 'string', enum: ['linked', 'not_linked'], example: 'not_linked' },
                        permissions: {
                            type: 'object',
                            description: 'Page-level access map. Missing pages default to false.',
                            example: {
                                dashboard: { access: true },
                                product_management: { access: true, sub: { merchant_sku: true, combine_sku: false, sku_mapping: true } },
                                inventory_management: { access: false, sub: { inventory_list: false, inbound: false } },
                                order_management: { access: true, sub: { all_orders: true, manual_orders: false } },
                                warehouse_management: { access: false },
                                system_configuration: { access: false, sub: { store_authorization: false, sub_account: false, role_management: false } },
                            },
                            properties: {
                                dashboard: { type: 'object', properties: { access: { type: 'boolean' } } },
                                product_management: { type: 'object', properties: { access: { type: 'boolean' }, sub: { type: 'object', properties: { merchant_sku: { type: 'boolean' }, combine_sku: { type: 'boolean' }, sku_mapping: { type: 'boolean' } } } } },
                                inventory_management: { type: 'object', properties: { access: { type: 'boolean' }, sub: { type: 'object', properties: { inventory_list: { type: 'boolean' }, inbound: { type: 'boolean' } } } } },
                                order_management: { type: 'object', properties: { access: { type: 'boolean' }, sub: { type: 'object', properties: { all_orders: { type: 'boolean' }, manual_orders: { type: 'boolean' } } } } },
                                warehouse_management: { type: 'object', properties: { access: { type: 'boolean' } } },
                                system_configuration: { type: 'object', properties: { access: { type: 'boolean' }, sub: { type: 'object', properties: { store_authorization: { type: 'boolean' }, sub_account: { type: 'boolean' }, role_management: { type: 'boolean' } } } } },
                            },
                        },
                    },
                },
                PermissionTemplateResponse: {
                    type: 'object',
                    properties: {
                        pages: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    key: { type: 'string', example: 'product_management' },
                                    label: { type: 'string', example: 'Product Management' },
                                    hasSub: { type: 'boolean', example: true },
                                    sub: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                key: { type: 'string', example: 'merchant_sku' },
                                                label: { type: 'string', example: 'Merchant SKU' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        defaultPermissions: { type: 'object' },
                    },
                },
                // ── Warehouse ─────────────────────────────────────────────────
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
                        attribute: { type: 'string', enum: ['own_warehouse', 'third_party_warehouse'], example: 'own_warehouse', description: 'Warehouse type' },
                        managerName: { type: 'string', maxLength: 100, example: 'John Doe', description: 'Warehouse manager name' },
                        phone: { type: 'string', maxLength: 30, example: '+1234567890', description: 'Contact phone number' },
                        location: { type: 'string', maxLength: 500, example: '123 Business Park, KL', description: 'Full address' },
                        city: { type: 'string', maxLength: 100, example: 'Kuala Lumpur', description: 'City' },
                        country: { type: 'string', maxLength: 100, example: 'Malaysia', description: 'Country' },
                        status: { type: 'string', enum: ['active', 'inactive'], default: 'active', example: 'active', description: 'Warehouse status' },
                    },
                },
                UpdateWarehouseRequest: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', minLength: 2, maxLength: 150, example: 'Main Warehouse Updated' },
                        attribute: { type: 'string', enum: ['own_warehouse', 'third_party_warehouse'], example: 'own_warehouse' },
                        managerName: { type: 'string', maxLength: 100, example: 'Jane Doe' },
                        phone: { type: 'string', maxLength: 30, example: '+0987654321' },
                        location: { type: 'string', maxLength: 500, example: '456 Business Ave' },
                        city: { type: 'string', maxLength: 100, example: 'Selangor' },
                        country: { type: 'string', maxLength: 100, example: 'Malaysia' },
                        status: { type: 'string', enum: ['active', 'inactive'], example: 'inactive' },
                    },
                },

            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication & session management' },
            { name: 'Users', description: 'Sub-account management' },
            { name: 'Companies', description: 'Company profile & subscription' },
            { name: 'Roles', description: 'Role & permission management' },
            { name: 'Warehouses', description: 'Warehouse setup & zones' },
            { name: 'Platforms', description: 'E-commerce platform connections' },
            { name: 'Products', description: 'Product catalog' },
            { name: 'Merchant SKUs', description: 'Merchant SKU management' },
            { name: 'Combine SKUs', description: 'Bundle / combine SKU management' },
            { name: 'SKU Mapping', description: 'Platform ↔ product SKU mapping' },
            { name: 'Inventory', description: 'Stock levels & movements' },
            { name: 'Inbound', description: 'Inbound orders & receiving' },
            { name: 'Orders', description: 'Platform order management' },
            { name: 'Manual Orders', description: 'Manually created orders' },
            { name: 'Dashboard', description: 'KPIs & analytics' },
        ],
        paths: {

            // ── Auth ──────────────────────────────────────────────────────────
            '/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Register a new company (creates admin account)',
                    description: 'Creates company + owner role + admin user in one transaction. No auth required.',
                    security: [],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
                    responses: {
                        201: { description: 'Company & admin account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                        400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                        409: { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                        429: { description: 'Too many requests — rate limited' },
                    },
                },
            },
            '/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'Login — works for admin and sub accounts',
                    description: 'Single login endpoint for all user types. Returns JWT access + refresh tokens.',
                    security: [],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
                    responses: {
                        200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                        400: { description: 'Validation failed' },
                        401: { description: 'Invalid email or password' },
                        403: { description: 'Account deactivated or company suspended' },
                        429: { description: 'Too many login attempts — rate limited' },
                    },
                },
            },
            '/auth/logout': {
                post: {
                    tags: ['Auth'],
                    summary: 'Logout — kills session and blacklists token in Redis',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Logged out successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/auth/refresh-token': {
                post: {
                    tags: ['Auth'],
                    summary: 'Refresh access token using refresh token',
                    security: [],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string', example: 'eyJhbGci...' } } } } },
                    },
                    responses: {
                        200: { description: 'New access token issued' },
                        401: { description: 'Invalid or expired refresh token' },
                    },
                },
            },
            '/auth/me': {
                get: {
                    tags: ['Auth'],
                    summary: 'Get currently authenticated user profile',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Profile fetched successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
                        401: { description: 'Unauthorized — invalid or expired token' },
                    },
                },
            },

            // ── Users (Sub Accounts) ──────────────────────────────────────────
            '/users': {
                get: {
                    tags: ['Users'],
                    summary: 'Get all sub accounts for the company (paginated)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: 'query', name: 'page', schema: { type: 'integer', default: 1, example: 1 }, description: 'Page number' },
                        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, example: 20 }, description: 'Items per page' },
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


            // ── Roles ────────────────────────────────────────────────────────
            '/roles/permissions/template': {
                get: {
                    tags: ['Roles'],
                    summary: 'Get permission template — all pages and sub-pages',
                    description: 'Returns the full permission structure the frontend uses to render the Add/Edit Role checkbox UI.',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Permission template', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/PermissionTemplateResponse' } } } } } },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/roles': {
                get: {
                    tags: ['Roles'],
                    summary: 'Get all roles for the company (paginated)',
                    description: 'Includes user_count per role. Supports search and filter by linking status.',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                        { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, description: 'Items per page' },
                        { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by name or description' },
                        { in: 'query', name: 'subAccountLinkingStatus', schema: { type: 'string', enum: ['linked', 'not_linked'] }, description: 'Filter by linking status' },
                    ],
                    responses: {
                        200: { description: 'Roles list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/RoleResponse' } }, pagination: { type: 'object' } } } } } },
                        401: { description: 'Unauthorized' },
                    },
                },
                post: {
                    tags: ['Roles'],
                    summary: 'Create a new role — owner/admin only',
                    description: 'Permissions default to false for any page not specified. Owner role is auto-created on registration and cannot be duplicated.',
                    security: [{ bearerAuth: [] }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } } },
                    responses: {
                        201: { description: 'Role created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                        400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                        403: { description: 'Permission denied' },
                        409: { description: 'Role name already exists' },
                    },
                },
            },
            '/roles/{id}': {
                get: {
                    tags: ['Roles'],
                    summary: 'Get a specific role by ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                    responses: {
                        200: { description: 'Role details', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                        404: { description: 'Role not found' },
                    },
                },
                put: {
                    tags: ['Roles'],
                    summary: 'Update a role — owner/admin only',
                    description: 'Updates name, description, permissions, and/or linking status. Owner role cannot be modified.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        description: { type: 'string' },
                                        subAccountLinkingStatus: { type: 'string', enum: ['linked', 'not_linked'] },
                                        permissions: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                        403: { description: 'Permission denied or Owner role' },
                        404: { description: 'Role not found' },
                        409: { description: 'Role name already exists' },
                    },
                },
                delete: {
                    tags: ['Roles'],
                    summary: 'Delete a role — owner/admin only',
                    description: 'Cannot delete Owner role or a role that has active sub accounts assigned to it.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                    responses: {
                        200: { description: 'Deleted successfully' },
                        400: { description: 'Role has active sub accounts — reassign first' },
                        403: { description: 'Permission denied or Owner role' },
                        404: { description: 'Role not found' },
                    },
                },
            },
            '/roles/{id}/permissions': {
                patch: {
                    tags: ['Roles'],
                    summary: 'Update role permissions only — owner/admin only',
                    description: 'Replaces the full permissions map. Use this for the checkbox UI Save action.',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 3 } }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['permissions'],
                                    properties: {
                                        permissions: {
                                            type: 'object',
                                            example: {
                                                dashboard: { access: true },
                                                product_management: { access: true, sub: { merchant_sku: true, combine_sku: true, sku_mapping: false } },
                                                inventory_management: { access: true, sub: { inventory_list: true, inbound: true } },
                                                order_management: { access: false },
                                                warehouse_management: { access: false },
                                                system_configuration: { access: false },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Permissions updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/RoleResponse' } } } } } },
                        403: { description: 'Permission denied or Owner role' },
                        404: { description: 'Role not found' },
                    },
                },
            },
            // ── Warehouses ────────────────────────────────────────────────────
            '/warehouses': {
                get: {
                    tags: ['Warehouses'],
                    summary: 'Get all warehouses for the company',
                    description: 'Returns paginated list. Default warehouse is always first. Accessible to all authenticated users.',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
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
    },
    apis: [
        './modules/**/*.routes.js',
        './modules/**/*.controller.js',
    ],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;