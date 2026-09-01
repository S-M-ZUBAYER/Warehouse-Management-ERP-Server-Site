'use strict';

module.exports = {
    schemas: {
        PlatformOrderActivityLog: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 101 },
                companyId: { type: 'integer', example: 1 },
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'tiktok' },
                platformStoreId: { type: 'integer', nullable: true, example: 10 },
                storeId: { type: 'string', nullable: true, example: 'SHOP123' },
                storeName: { type: 'string', nullable: true, example: 'TikTok VN Store' },
                platformOrderId: { type: 'string', example: 'ORDER123456' },
                platformOrderItemId: { type: 'string', nullable: true, example: 'ITEM123' },
                packageNumber: { type: 'string', nullable: true, example: 'PKG123' },
                trackingNumber: { type: 'string', nullable: true, example: 'TTS123456789' },
                eventType: { type: 'string', example: 'ORDER_SHIPPED' },
                title: { type: 'string', example: 'Order shipped' },
                message: { type: 'string', nullable: true, example: 'TikTok webhook marked this order as shipped.' },
                oldStatus: { type: 'string', nullable: true, example: 'TO_PICKUP' },
                newStatus: { type: 'string', nullable: true, example: 'SHIPPED' },
                actorType: { type: 'string', enum: ['USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM'], example: 'WEBHOOK' },
                actorId: { type: 'integer', nullable: true, example: null },
                actorName: { type: 'string', nullable: true, example: 'TikTok Webhook' },
                source: { type: 'string', nullable: true, example: 'TIKTOK_WEBHOOK' },
                sourceEventId: { type: 'string', nullable: true, example: 'tiktok-ORDER123456-ORDER_SHIPPED-001' },
                platformRegion: { type: 'string', nullable: true, example: 'VN' },
                platformTimezone: { type: 'string', nullable: true, example: 'Asia/Ho_Chi_Minh' },
                platformLocalOccurredAt: { type: 'string', nullable: true, example: '2026-08-28 17:30:00' },
                metadata: { type: 'object', example: { rawStatus: 'SHIPPED', webhookTopic: 'order_status_update' } },
                occurredAt: { type: 'string', format: 'date-time', example: '2026-08-28T10:30:00Z' },
                createdAt: { type: 'string', format: 'date-time', example: '2026-08-28T10:30:01Z' },
            },
        },
        PlatformOrderActivityLogCreateRequest: {
            type: 'object',
            required: ['companyId', 'platform', 'platformOrderId'],
            properties: {
                companyId: { type: 'integer', example: 1 },
                platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'tiktok' },
                platformOrderId: { type: 'string', example: 'ORDER123456' },
                platformOrderItemId: { type: 'string', example: 'ITEM123' },
                platformStoreId: { type: 'integer', example: 10 },
                storeId: { type: 'string', example: 'SHOP123' },
                storeName: { type: 'string', example: 'TikTok VN Store' },
                packageNumber: { type: 'string', example: 'PKG123' },
                trackingNumber: { type: 'string', example: 'TTS123456789' },
                eventType: { type: 'string', example: 'ORDER_SHIPPED' },
                title: { type: 'string', example: 'Order shipped' },
                message: { type: 'string', example: 'TikTok webhook marked this order as shipped.' },
                oldStatus: { type: 'string', example: 'TO_PICKUP' },
                newStatus: { type: 'string', example: 'SHIPPED' },
                actorType: { type: 'string', enum: ['USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM'], example: 'WEBHOOK' },
                actorName: { type: 'string', example: 'TikTok Webhook' },
                source: { type: 'string', example: 'TIKTOK_WEBHOOK' },
                sourceEventId: {
                    type: 'string',
                    example: 'tiktok-ORDER123456-ORDER_SHIPPED-001',
                    description: 'Unique webhook event id. Use this to avoid duplicate log rows when the marketplace retries the same webhook.',
                },
                platformRegion: {
                    type: 'string',
                    example: 'VN',
                    description: 'Marketplace/order country code. Used to save platform local time when platformTimezone is not sent.',
                },
                platformTimezone: {
                    type: 'string',
                    example: 'Asia/Ho_Chi_Minh',
                    description: 'Optional IANA timezone. If omitted, server resolves it from platformRegion or the saved store region.',
                },
                platformLocalOccurredAt: {
                    type: 'string',
                    example: '2026-08-28 17:30:00',
                    description: 'Optional already-formatted local marketplace time. If omitted, server calculates it.',
                },
                occurredAt: { type: 'string', format: 'date-time', example: '2026-08-28T10:30:00Z' },
                metadata: { type: 'object', example: { rawStatus: 'SHIPPED', webhookTopic: 'order_status_update' } },
            },
        },
        PlatformOrderActivityLogBulkCreateRequest: {
            type: 'object',
            required: ['logs'],
            properties: {
                logs: {
                    type: 'array',
                    minItems: 1,
                    items: { $ref: '#/components/schemas/PlatformOrderActivityLogCreateRequest' },
                },
            },
        },
    },
    paths: {
        '/platform-order-activity/activity-logs': {
            post: {
                tags: ['Platform Order Activity Logs'],
                summary: 'Create platform order activity log from webhook',
                description: 'Public API for Shopee/TikTok webhook workers to store order status timeline events. If ORDER_WEBHOOK_API_KEY is configured, send it as x-order-webhook-key or x-api-key. If ORDER_WEBHOOK_API_KEY is empty, no key is required.',
                security: [{ orderWebhookApiKey: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PlatformOrderActivityLogCreateRequest' },
                            examples: {
                                tiktokShipped: {
                                    value: {
                                        companyId: 1,
                                        platform: 'tiktok',
                                        platformOrderId: 'ORDER123456',
                                        storeId: 'SHOP123',
                                        eventType: 'ORDER_SHIPPED',
                                        title: 'Order shipped',
                                        oldStatus: 'TO_PICKUP',
                                        newStatus: 'SHIPPED',
                                        actorType: 'WEBHOOK',
                                        source: 'TIKTOK_WEBHOOK',
                                        sourceEventId: 'tiktok-ORDER123456-ORDER_SHIPPED-001',
                                        platformRegion: 'VN',
                                        metadata: { rawStatus: 'SHIPPED' },
                                    },
                                },
                                shopeeCompleted: {
                                    value: {
                                        companyId: 1,
                                        platform: 'shopee',
                                        platformOrderId: 'SHOPEE123456',
                                        storeId: '123456',
                                        eventType: 'ORDER_COMPLETED',
                                        title: 'Order completed',
                                        oldStatus: 'SHIPPED',
                                        newStatus: 'COMPLETED',
                                        actorType: 'WEBHOOK',
                                        source: 'SHOPEE_WEBHOOK',
                                        sourceEventId: 'shopee-SHOPEE123456-ORDER_COMPLETED-001',
                                        platformRegion: 'MY',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Activity log saved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Order activity log saved' },
                                        data: { $ref: '#/components/schemas/PlatformOrderActivityLog' },
                                    },
                                },
                            },
                        },
                    },
                    200: { description: 'Activity log already exists for duplicate sourceEventId' },
                    400: { description: 'Validation failed' },
                    401: { description: 'Invalid webhook API key' },
                },
            },
        },
        '/order-management/platform-orders/{platform}/{orderId}/activity-logs': {
            get: {
                tags: ['Platform Order Activity Logs'],
                summary: 'List activity logs for one platform order',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'platform', required: true, schema: { type: 'string', enum: ['shopee', 'tiktok'] } },
                    { in: 'path', name: 'orderId', required: true, schema: { type: 'string', example: 'ORDER123456' } },
                ],
                responses: {
                    200: {
                        description: 'Activity logs loaded',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Order activity logs loaded' },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/PlatformOrderActivityLog' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/order-management/platform-orders/activity-logs': {
            post: {
                tags: ['Platform Order Activity Logs'],
                summary: 'Create one activity log from ERP',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PlatformOrderActivityLogCreateRequest' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Activity log saved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Order activity log saved' },
                                        data: { $ref: '#/components/schemas/PlatformOrderActivityLog' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/order-management/platform-orders/activity-logs/bulk': {
            post: {
                tags: ['Platform Order Activity Logs'],
                summary: 'Create multiple activity logs from ERP',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PlatformOrderActivityLogBulkCreateRequest' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Activity logs saved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Order activity logs saved' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                count: { type: 'integer', example: 2 },
                                                logs: {
                                                    type: 'array',
                                                    items: { $ref: '#/components/schemas/PlatformOrderActivityLog' },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};
