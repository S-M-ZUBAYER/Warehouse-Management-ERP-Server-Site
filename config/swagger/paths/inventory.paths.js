/**
 * inventory.paths.js
 * * Generated from Inventory OpenAPI JSDoc annotations.
 */

module.exports = {
    schemas: {
        WarehouseShort: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                name: { type: 'string', example: 'Main Warehouse KL' },
                code: { type: 'string', example: 'WH-KL-01' },
                is_default: { type: 'boolean', example: true }
            }
        },
        MerchantSkuShort: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 5 },
                sku_name: { type: 'string', example: 'WM-012' },
                sku_title: { type: 'string', example: 'Ergonomic Wireless Mouse' },
                gtin: { type: 'string', nullable: true, example: '012345678901' },
                image_url: { type: 'string', nullable: true, example: '/uploads/merchant-skus/sku-abc123.jpg' },
                status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
                price: { type: 'number', nullable: true, example: 89.90 }
            }
        },
        MappingShort: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 12 },
                sync_status: { type: 'string', enum: ['pending', 'synced', 'out_of_sync', 'failed'], example: 'synced' },
                is_active: { type: 'boolean', example: true },
                last_synced_at: { type: 'string', format: 'date-time', nullable: true, example: '2025-04-15T08:30:00.000Z' }
            }
        },
        InventoryRow: {
            type: 'object',
            properties: {
                id: { type: 'integer', description: 'sku_warehouse_stock primary key', example: 36 },
                qty_on_hand: { type: 'integer', example: 120 },
                qty_reserved: { type: 'integer', example: 5 },
                qty_inbound: { type: 'integer', example: 0 },
                qty_available: { type: 'integer', description: 'Computed: qty_on_hand - qty_reserved', example: 115 },
                min_stock: { type: 'integer', nullable: true, example: 10 },
                stock_alert_status: { type: 'string', enum: ['In Stock', 'Low Stock', 'Out of Stock', 'No Alert'], example: 'In Stock' },
                merchantSku: { $ref: '#/components/schemas/MerchantSkuShort' },
                warehouse: { $ref: '#/components/schemas/WarehouseShort' },
                is_mapped: { type: 'boolean', example: true },
                mapping_count: { type: 'integer', example: 2 },
                mappings: { type: 'array', items: { $ref: '#/components/schemas/MappingShort' } }
            }
        },
        InventoryCounts: {
            type: 'object',
            properties: {
                all: { type: 'integer', example: 100 },
                mapped: { type: 'integer', example: 80 },
                unmapped: { type: 'integer', example: 20 }
            }
        },
        Pagination: {
            type: 'object',
            properties: {
                total: { type: 'integer', example: 100 },
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                totalPages: { type: 'integer', example: 5 }
            }
        }
    },
    paths: {
        '/inventory/dropdowns': {
            get: {
                tags: ['Inventory'],
                summary: 'Get filter dropdown data',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Dropdowns fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                warehouses: { type: 'array', items: { $ref: '#/components/schemas/WarehouseShort' } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/inventory/counts': {
            get: {
                tags: ['Inventory'],
                summary: 'Get tab badge counts',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' }, required: false }
                ],
                responses: {
                    200: {
                        description: 'Counts fetched',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/InventoryCounts' } } }
                    }
                }
            }
        },
        '/inventory': {
            get: {
                tags: ['Inventory'],
                summary: 'Get paginated inventory list',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer' } },
                    { in: 'query', name: 'skuType', schema: { type: 'string', enum: ['sku_name', 'product_name', 'gtin', 'store_id'] } },
                    { in: 'query', name: 'search', schema: { type: 'string' } },
                    { in: 'query', name: 'mappingStatus', schema: { type: 'string', enum: ['all', 'mapped', 'unmapped'] } },
                    { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } }
                ],
                responses: {
                    200: {
                        description: 'Inventory list fetched',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: { type: 'array', items: { $ref: '#/components/schemas/InventoryRow' } },
                                        pagination: { $ref: '#/components/schemas/Pagination' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/inventory/stock-alert': {
            put: {
                tags: ['Inventory'],
                summary: 'Set minimum stock alert threshold',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['skuIds', 'minStock'],
                                properties: {
                                    skuIds: { type: 'array', items: { type: 'integer' } },
                                    minStock: { type: 'integer', minimum: 0 }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Stock alert updated' },
                    403: { description: 'Forbidden — insufficient permissions' }
                }
            }
        },
        '/inventory/sync': {
            put: {
                tags: ['Inventory'],
                summary: 'Queue mapped SKUs for stock sync',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    skuIds: { type: 'array', items: { type: 'integer' }, description: 'Empty array to sync all' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Sync queued successfully' }
                }
            }
        }
    }
};