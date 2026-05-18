module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
        PageNode: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                key: { type: 'string', example: 'product_management' },
                label: { type: 'string', example: 'Product Management', nullable: true },
                level: { type: 'integer', example: 1, description: '1 = top-level, 2 = sub, 3 = sub-sub' },
                has_sub: { type: 'boolean', example: true },
                order: { type: 'integer', example: 0 },
                is_active: { type: 'boolean', example: true },
                parent_id: { type: 'integer', example: null, nullable: true },
                sub: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/PageNode' },
                    description: 'Nested children (sub-pages)',
                },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
            },
        },

        SeedPageNode: {
            type: 'object',
            required: ['key'],
            properties: {
                key: { type: 'string', example: 'product_management', description: 'Unique snake_case key' },
                label: { type: 'string', example: 'Product Management', nullable: true },
                hasSub: { type: 'boolean', example: true },
                sub: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SeedPageNode' },
                    description: 'Nested sub-pages (up to 3 levels)',
                },
            },
        },

        UpdatePageRequest: {
            type: 'object',
            properties: {
                key: { type: 'string', example: 'product_list', description: 'Unique snake_case key' },
                label: { type: 'string', example: 'Product List', nullable: true },
                hasSub: { type: 'boolean', example: false },
                order: { type: 'integer', example: 2, description: 'Sort order within the same parent' },
                isActive: { type: 'boolean', example: true },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/pages': {
            get: {
                tags: ['Pages'],
                summary: 'Get all pages as a nested tree',
                description: 'Returns the full sidebar navigation structure as a nested tree. Accessible to all authenticated users. Results are cached for 5 minutes.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Pages fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Pages fetched successfully' },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/PageNode' },
                                        },
                                    },
                                },
                                example: {
                                    success: true,
                                    message: 'Pages fetched successfully',
                                    data: [
                                        {
                                            id: 1,
                                            key: 'dashboard',
                                            label: null,
                                            level: 1,
                                            has_sub: false,
                                            order: 0,
                                            is_active: true,
                                            parent_id: null,
                                            sub: [],
                                        },
                                        {
                                            id: 2,
                                            key: 'product_management',
                                            label: null,
                                            level: 1,
                                            has_sub: true,
                                            order: 1,
                                            is_active: true,
                                            parent_id: null,
                                            sub: [
                                                { id: 7, key: 'product_list', level: 2, has_sub: false, order: 0, sub: [] },
                                                { id: 8, key: 'combine_sku', level: 2, has_sub: false, order: 1, sub: [] },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },

        '/pages/seed': {
            post: {
                tags: ['Pages'],
                summary: 'Seed / bulk upsert the full page structure — owner only',
                description: 'Accepts the full nested pages array and upserts all entries. Safe to call multiple times — uses key as the unique identifier. Clears cache on success.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['pages'],
                                properties: {
                                    pages: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/SeedPageNode' },
                                    },
                                },
                            },
                            example: {
                                pages: [
                                    { key: 'dashboard', hasSub: false },
                                    {
                                        key: 'product_management',
                                        hasSub: true,
                                        sub: [
                                            { key: 'product_list', hasSub: false },
                                            { key: 'combine_sku', hasSub: false },
                                        ],
                                    },
                                    {
                                        key: 'inventory_management',
                                        hasSub: true,
                                        sub: [
                                            { key: 'inventory_list', hasSub: false },
                                            {
                                                key: 'inbound',
                                                hasSub: true,
                                                sub: [
                                                    { key: 'inbound_draft' },
                                                    { key: 'inbound_on_the_way' },
                                                    { key: 'inbound_complete' },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        key: 'order_management',
                                        hasSub: true,
                                        sub: [
                                            {
                                                key: 'order_processing',
                                                hasSub: true,
                                                sub: [
                                                    { key: 'new_order' },
                                                    { key: 'processed_order' },
                                                    { key: 'shipped_order' },
                                                    { key: 'completed_order' },
                                                    { key: 'all_order' },
                                                    { key: 'canceled_order' },
                                                ],
                                            },
                                            { key: 'manual_order', hasSub: false },
                                        ],
                                    },
                                    { key: 'warehouse_management', hasSub: false },
                                    {
                                        key: 'system_configuration',
                                        hasSub: true,
                                        sub: [
                                            { key: 'store_authorization', hasSub: false },
                                            {
                                                key: 'account_management',
                                                hasSub: true,
                                                sub: [
                                                    { key: 'sub_account' },
                                                    { key: 'role_management' },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Pages seeded successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        data: { type: 'array', items: { $ref: '#/components/schemas/PageNode' } },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner only' },
                },
            },
        },

        '/pages/{id}': {
            put: {
                tags: ['Pages'],
                summary: 'Update a single page — owner only',
                description: 'Update key, label, order, hasSub, or isActive for a single page entry.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Page ID' }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePageRequest' } } },
                },
                responses: {
                    200: { description: 'Page updated successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { $ref: '#/components/schemas/PageNode' } } } } } },
                    400: { description: 'Validation failed' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner only' },
                    404: { description: 'Page not found' },
                    409: { description: 'Page key already exists' },
                },
            },
            delete: {
                tags: ['Pages'],
                summary: 'Delete a page — owner only',
                description: 'Cannot delete a page that has sub-pages. Delete children first.',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 1 }, description: 'Page ID' }],
                responses: {
                    200: { description: 'Page deleted successfully' },
                    400: { description: 'Cannot delete — has sub-pages' },
                    401: { description: 'Unauthorized' },
                    403: { description: 'Forbidden — owner only' },
                    404: { description: 'Page not found' },
                },
            },
        },
    },
};