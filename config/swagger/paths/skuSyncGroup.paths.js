'use strict';

module.exports = {
    schemas: {
        SkuSyncGroup: {
            type: 'object',
            properties: {
                id:   { type: 'integer', example: 3 },
                name: { type: 'string',  example: 'TP870 Group' },
                primarySku: {
                    type: 'object',
                    properties: {
                        id:        { type: 'integer', example: 12 },
                        sku_name:  { type: 'string',  example: 'TP870' },
                        sku_title: { type: 'string',  example: 'Ergonomic wireless mouse' },
                        image_url: { type: 'string',  example: 'https://cdn.example.com/img.jpg' },
                    },
                },
                members: {
                    type:  'array',
                    items: {
                        type: 'object',
                        properties: {
                            memberId:  { type: 'integer', example: 7 },
                            memberSku: { $ref: '#/components/schemas/MerchantSkuBasic' },
                        },
                    },
                },
                memberCount: { type: 'integer', example: 2 },
            },
        },

        MerchantSkuBasic: {
            type: 'object',
            properties: {
                id:           { type: 'integer', example: 25 },
                sku_name:     { type: 'string',  example: 'TP890' },
                sku_title:    { type: 'string',  example: 'Compact wireless mouse v2' },
                image_url:    { type: 'string',  example: 'https://cdn.example.com/img.jpg' },
                warehouse_id: { type: 'integer', example: 1 },
            },
        },
    },

    paths: {
        '/sku-sync-groups': {
            get: {
                tags:        ['SKU Sync Groups'],
                summary:     'List all merchant SKU sync groups for the company',
                description: 'Returns all sync groups with their primary SKU and member SKUs.',
                security:    [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Sync groups list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Sync groups' },
                                        data: {
                                            type:  'array',
                                            items: { $ref: '#/components/schemas/SkuSyncGroup' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
            post: {
                tags:        ['SKU Sync Groups'],
                summary:     'Create a new sync group with a primary merchant SKU',
                description: 'Designates a merchant SKU as the "primary" of a new sync group. Other (secondary) SKUs can then be linked to it.',
                security:    [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['primarySkuId'],
                                properties: {
                                    primarySkuId: { type: 'integer', example: 12, description: 'ID of the merchant SKU that will be the primary (master) of the group' },
                                    name:         { type: 'string',  example: 'TP870 Group', description: 'Optional human-readable group label' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Sync group created',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'Sync group created' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                groupId:    { type: 'integer', example: 3 },
                                                primarySku: { type: 'string',  example: 'TP870' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation error' },
                    409: { description: 'SKU is already in a sync group' },
                },
            },
        },

        '/sku-sync-groups/eligible-secondaries': {
            get: {
                tags:        ['SKU Sync Groups'],
                summary:     'Get eligible secondary SKUs for a given primary SKU',
                description: 'Returns merchant SKUs that can be added as secondaries. Filters out SKUs in other groups, different warehouses, or mapped to the same platform stores as the primary.',
                security:    [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'primarySkuId', required: true, schema: { type: 'integer', example: 12 }, description: 'ID of the primary merchant SKU' },
                ],
                responses: {
                    200: {
                        description: 'List of eligible secondary SKUs',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: {
                                            type:  'array',
                                            items: { $ref: '#/components/schemas/MerchantSkuBasic' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    404: { description: 'Primary SKU not found' },
                },
            },
        },

        '/sku-sync-groups/{groupId}': {
            get: {
                tags:     ['SKU Sync Groups'],
                summary:  'Get a single sync group with full details',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'groupId', required: true, schema: { type: 'integer', example: 3 } },
                ],
                responses: {
                    200: { description: 'Sync group details' },
                    404: { description: 'Group not found' },
                },
            },
            delete: {
                tags:        ['SKU Sync Groups'],
                summary:     'Dissolve (soft-delete) a sync group',
                description: 'Removes all member relationships and soft-deletes the group. SKUs return to standalone status. Platform mappings are NOT affected.',
                security:    [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'groupId', required: true, schema: { type: 'integer', example: 3 } },
                ],
                responses: {
                    200: { description: 'Group dissolved' },
                    404: { description: 'Group not found' },
                },
            },
        },

        '/sku-sync-groups/{groupId}/members': {
            post: {
                tags:        ['SKU Sync Groups'],
                summary:     'Add a secondary SKU to a sync group',
                description: 'Links a secondary merchant SKU to an existing group. The secondary SKU must share the same warehouse as the primary, not be mapped to overlapping platform stores, and not already be in another sync group.',
                security:    [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'groupId', required: true, schema: { type: 'integer', example: 3 } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['secondarySkuId'],
                                properties: {
                                    secondarySkuId: { type: 'integer', example: 25, description: 'ID of the merchant SKU to add as a secondary member' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Secondary SKU linked to group' },
                    400: { description: 'Validation error' },
                    404: { description: 'Group or SKU not found' },
                    409: { description: 'Conflict — same warehouse required, overlapping platform store mappings, or SKU already in a group' },
                },
            },
        },

        '/sku-sync-groups/{groupId}/members/{memberSkuId}': {
            delete: {
                tags:        ['SKU Sync Groups'],
                summary:     'Remove a secondary SKU from a sync group',
                description: 'Unlinks the secondary SKU. The SKU returns to standalone status. Its platform_sku_mappings are not affected.',
                security:    [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'groupId',     required: true, schema: { type: 'integer', example: 3 } },
                    { in: 'path', name: 'memberSkuId', required: true, schema: { type: 'integer', example: 25 }, description: 'merchant_sku_id of the secondary member to remove' },
                ],
                responses: {
                    200: { description: 'Member removed' },
                    404: { description: 'Member not found in this group' },
                },
            },
        },

        '/platform-products/map-merchant-sku': {
            post: {
                tags:        ['Platform Products'],
                summary:     'Map an unmapped platform product to a merchant SKU',
                description: 'Called from the ByProduct SKU Mapping page when a user selects "Add Mapping with Store" on an unmapped product row and picks a merchant SKU.',
                security:    [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type:     'object',
                                required: ['platformProductId', 'merchantSkuId'],
                                properties: {
                                    platformProductId: { type: 'integer', example: 88,  description: 'ID from the platform_products table (the unmapped product)' },
                                    merchantSkuId:     { type: 'integer', example: 12,  description: 'ID from the merchant_skus table to link to' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Mapping created successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string', example: 'TP870 mapped successfully' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                mappingId:   { type: 'integer', example: 45 },
                                                merchantSku: { type: 'string',  example: 'TP870' },
                                                platform:    { type: 'string',  example: 'tiktok' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation error — missing fields' },
                    404: { description: 'Platform product or merchant SKU not found' },
                    409: { description: 'This merchant SKU is already mapped to this platform product' },
                },
            },
        },
    },
};