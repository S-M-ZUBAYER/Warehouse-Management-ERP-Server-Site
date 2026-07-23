'use strict';

module.exports = {
    schemas: {
        EasyParcelTokenStatus: {
            type: 'object',
            properties: {
                country: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], example: 'MY' },
                accessTokenSet: { type: 'boolean', example: true },
                refreshTokenSet: { type: 'boolean', example: true },
                accessTokenPreview: { type: 'string', example: 'abcd...wxyz' },
                refreshTokenPreview: { type: 'string', example: 'r123...z789' },
                expiresAt: { type: 'string', format: 'date-time', nullable: true },
                persisted: { type: 'boolean', example: true },
            },
        },
        AfterShipConfigStatus: {
            type: 'object',
            properties: {
                supported: { type: 'boolean', example: true },
                country: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], example: 'PH' },
                name: { type: 'string', example: 'Philippines' },
                currency: { type: 'string', example: 'PHP' },
                mode: { type: 'string', enum: ['sandbox', 'production'], example: 'sandbox' },
                apiKeySet: { type: 'boolean', example: true },
                apiKeyPreview: { type: 'string', example: 'abcd...wxyz' },
                shippingBaseUrl: { type: 'string', example: 'https://sandbox-api.aftership.com/postmen/v3' },
                trackingBaseUrl: { type: 'string', example: 'https://api.aftership.com/tracking/2026-01' },
                defaultShipperAccountId: { type: 'string', example: 'shipper-account-id' },
                defaultCourierSlug: { type: 'string', example: 'ninjavan-ph' },
                defaultServiceType: { type: 'string', example: 'standard' },
            },
        },
        AfterShipRate: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'rate-id' },
                rateId: { type: 'string', example: 'rate-id' },
                serviceId: { type: 'string', example: 'standard' },
                serviceType: { type: 'string', example: 'standard' },
                serviceName: { type: 'string', example: 'Standard Delivery' },
                company: { type: 'string', example: 'AfterShip Courier' },
                courierSlug: { type: 'string', example: 'ninjavan-ph' },
                shipperAccountId: { type: 'string', example: 'shipper-account-id' },
                price: { type: 'number', example: 120 },
                currency: { type: 'string', example: 'PHP' },
                delivery: { type: 'string', example: '2-4 business days' },
                codAvailable: { type: 'boolean', example: false },
                raw: { type: 'object' },
            },
        },
    },
    paths: {
        '/order-management/manual-orders/sku-search': {
            get: {
                tags: ['Manual Orders'],
                summary: 'Search merchant SKUs by warehouse stock',
                description: 'Returns active merchant SKUs that have stock rows for the selected warehouse. Stock quantities are flattened at the top level of each SKU row for the manual order SKU picker.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', required: true, schema: { type: 'integer', example: 1 }, description: 'Warehouse ID used to filter sku_warehouse_stock rows.' },
                    { in: 'query', name: 'search', required: false, schema: { type: 'string', example: 'SKU-001' }, description: 'Optional search by SKU name or SKU title.' },
                    { in: 'query', name: 'page', required: false, schema: { type: 'integer', default: 1, minimum: 1 }, description: 'Page number.' },
                    { in: 'query', name: 'limit', required: false, schema: { type: 'integer', default: 50, minimum: 1, maximum: 200 }, description: 'Rows per page.' },
                    { in: 'query', name: 'skuType', required: false, schema: { type: 'string', enum: ['sku_name', 'product_name'], default: 'sku_name' }, description: 'Search priority used by the frontend picker.' },
                ],
                responses: {
                    200: {
                        description: 'Merchant SKU search results with flattened warehouse stock quantities',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            id: { type: 'integer', example: 101 },
                                                            merchant_sku_id: { type: 'integer', example: 101 },
                                                            sku_name: { type: 'string', example: 'SKU-001' },
                                                            sku_title: { type: 'string', example: 'Sample Product' },
                                                            product_name: { type: 'string', example: 'Sample Product' },
                                                            image_url: { type: 'string', example: 'https://example.com/product.jpg' },
                                                            price: { type: 'number', example: 19.99 },
                                                            weight: { type: 'number', example: 0.5 },
                                                            length: { type: 'number', example: 10 },
                                                            width: { type: 'number', example: 8 },
                                                            height: { type: 'number', example: 4 },
                                                            warehouse_id: { type: 'integer', example: 1 },
                                                            warehouse_name: { type: 'string', nullable: true, example: 'Main Warehouse' },
                                                            stock_id: { type: 'integer', nullable: true, example: 55 },
                                                            qty_on_hand: { type: 'integer', example: 120 },
                                                            total_available: { type: 'integer', example: 120 },
                                                            qty_reserved: { type: 'integer', example: 5 },
                                                            lock_quantity: { type: 'integer', example: 5 },
                                                            qty_inbound: { type: 'integer', example: 20 },
                                                            qty_available: { type: 'integer', example: 115 },
                                                            available_for_platform: { type: 'integer', example: 115 },
                                                            available_inventory: { type: 'integer', example: 115 },
                                                        },
                                                    },
                                                },
                                                pagination: {
                                                    type: 'object',
                                                    properties: {
                                                        total: { type: 'integer', example: 1 },
                                                        page: { type: 'integer', example: 1 },
                                                        limit: { type: 'integer', example: 50 },
                                                        totalPages: { type: 'integer', example: 1 },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'warehouseId is required or invalid' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/order-management/manual-orders/easyparcel/oauth/url': {
            get: {
                tags: ['Manual Orders'],
                summary: 'Get EasyParcel OAuth login URL',
                description: 'Returns the Developer Hub OAuth URL. Open this URL in a browser, authorize the app, then copy the code from the redirect URL.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'country', schema: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], default: 'MY' } },
                    { in: 'query', name: 'state', schema: { type: 'string' }, description: 'Optional state value returned by EasyParcel redirect.' },
                ],
                responses: {
                    200: {
                        description: 'OAuth URL generated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                country: { type: 'string', example: 'MY' },
                                                authUrl: { type: 'string', example: 'https://api.easyparcel.com/oauth/login?client_id=...' },
                                                redirectUri: { type: 'string', example: 'https://your-api.com/api/v1/order-management/manual-orders/easyparcel/callback' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Missing Client ID/Secret or redirect URI' },
                },
            },
        },
        '/order-management/manual-orders/easyparcel/oauth/exchange': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Exchange EasyParcel OAuth code for tokens',
                description: 'Use the authorization code from EasyParcel redirect to get access and refresh tokens. Set persist=true to save tokens into backend .env.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code'],
                                properties: {
                                    country: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], default: 'MY' },
                                    code: { type: 'string', example: 'AUTHORIZATION_CODE_FROM_REDIRECT' },
                                    state: { type: 'string', example: 'optional-state' },
                                    persist: { type: 'boolean', default: true, description: 'Save returned tokens into backend .env when true.' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Tokens received',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                country: { type: 'string', example: 'MY' },
                                                accessToken: { type: 'string', description: 'Returned once so admin can copy if needed.' },
                                                refreshToken: { type: 'string', description: 'Returned once so admin can copy if needed.' },
                                                expiresAt: { type: 'string', format: 'date-time', nullable: true },
                                                tokenStatus: { $ref: '#/components/schemas/EasyParcelTokenStatus' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation/configuration error' },
                    502: { description: 'EasyParcel token request failed' },
                },
            },
        },
        '/order-management/manual-orders/easyparcel/tokens': {
            put: {
                tags: ['Manual Orders'],
                summary: 'Manually update EasyParcel access/refresh tokens',
                description: 'Updates EasyParcel token cache for the running backend. Set persist=true to also write EASYPARCEL_{COUNTRY}_ACCESS_TOKEN, REFRESH_TOKEN, and TOKEN_EXPIRES_AT into backend .env.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    country: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], default: 'MY' },
                                    access_token: { type: 'string', example: 'ACCESS_TOKEN' },
                                    refresh_token: { type: 'string', example: 'REFRESH_TOKEN' },
                                    expires_in: { type: 'integer', example: 3600 },
                                    token_expires_at: { type: 'string', format: 'date-time', example: '2026-06-11T12:30:00.000Z' },
                                    persist: { type: 'boolean', default: true },
                                },
                                anyOf: [
                                    { required: ['access_token'] },
                                    { required: ['refresh_token'] },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Tokens updated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'EasyParcel tokens updated successfully' },
                                        data: { $ref: '#/components/schemas/EasyParcelTokenStatus' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Missing token or EasyParcel app credentials' },
                },
            },
        },
        '/order-management/manual-orders/easyparcel/tokens/refresh': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Refresh EasyParcel access token',
                description: 'Refreshes access token using the saved refresh token. Set persist=true to save the refreshed tokens into backend .env.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    country: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], default: 'MY' },
                                    persist: { type: 'boolean', default: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Token refreshed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        message: { type: 'string' },
                                        data: { $ref: '#/components/schemas/EasyParcelTokenStatus' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Refresh token missing or EasyParcel app credentials missing' },
                    502: { description: 'EasyParcel refresh failed' },
                },
            },
        },
        '/order-management/manual-orders/easyparcel/rates': {
            get: {
                tags: ['Manual Orders'],
                summary: 'Get EasyParcel rates for manual order',
                description: 'Looks up EasyParcel courier quotations for MY, SG, TH or ID domestic manual orders.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer', example: 1 } },
                    { in: 'query', name: 'senderPostcode', schema: { type: 'string', example: '50450' } },
                    { in: 'query', name: 'senderState', schema: { type: 'string', example: 'Kuala Lumpur' } },
                    { in: 'query', name: 'senderCountry', schema: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], example: 'MY' } },
                    { in: 'query', name: 'postcode', schema: { type: 'string', example: '50480' }, description: 'Receiver postcode.' },
                    { in: 'query', name: 'state', schema: { type: 'string', example: 'Kuala Lumpur' }, description: 'Receiver state/subdivision.' },
                    { in: 'query', name: 'country', schema: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], example: 'MY' }, description: 'Receiver country.' },
                    { in: 'query', name: 'weight', schema: { type: 'number', example: 0.5 } },
                    { in: 'query', name: 'length', schema: { type: 'number', example: 10 } },
                    { in: 'query', name: 'width', schema: { type: 'number', example: 10 } },
                    { in: 'query', name: 'height', schema: { type: 'number', example: 5 } },
                    { in: 'query', name: 'parcelValue', schema: { type: 'number', example: 50 } },
                ],
                responses: {
                    200: { description: 'Rate lookup result' },
                    400: { description: 'Configuration or validation error' },
                },
            },
        },
        '/order-management/manual-orders/easyparcel/shipment-details': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Get live EasyParcel shipment details',
                description: 'Fetches shipment details directly from the connected EasyParcel account using EasyParcel OpenAPI. This does not read manual order data from the ERP database. EasyParcel requires shipment_number format like ES-2601-K8S32.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['shipmentNumber'],
                                properties: {
                                    country: { type: 'string', enum: ['MY', 'SG', 'TH', 'ID'], default: 'MY', description: 'EasyParcel account country/token set to use.' },
                                    shipmentNumber: { type: 'string', example: 'ES-2601-K8S32', description: 'EasyParcel shipment number. Alias: shipment_number.' },
                                    shipment_number: { type: 'string', example: 'ES-2601-K8S32' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Live EasyParcel shipment details returned',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'EasyParcel shipment details fetched' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                message: { type: 'string', example: 'EasyParcel shipment details fetched' },
                                                country: { type: 'string', example: 'MY' },
                                                shipmentNumber: { type: 'string', example: 'ES-2601-K8S32' },
                                                shipment: {
                                                    type: 'object',
                                                    description: 'Shipment object returned by EasyParcel OpenAPI.',
                                                    properties: {
                                                        shipment_number: { type: 'string', example: 'ES-2601-K8S32' },
                                                        order_number: { type: 'string', example: 'EI-2601-U8FZW' },
                                                        shipment_details: { type: 'object' },
                                                        parcel_content: { type: 'array', items: { type: 'object' } },
                                                        courier: { type: 'object' },
                                                        sender: { type: 'object' },
                                                        receiver: { type: 'object' },
                                                        pricing: { type: 'object' },
                                                    },
                                                },
                                                easyParcelResponse: {
                                                    type: 'object',
                                                    description: 'Raw EasyParcel API response.',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Missing or invalid shipment number' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'EasyParcel shipment details not found' },
                    502: { description: 'EasyParcel shipment details request failed' },
                },
            },
        },
        '/order-management/manual-orders/{id}/easyparcel/status': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Refresh EasyParcel shipment status',
                description: 'Uses the stored AWB, parcel number, shipment number, or provider order number to request the latest EasyParcel tracking status and update the manual order status fields.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 101 }, description: 'Manual order ID.' },
                ],
                responses: {
                    200: {
                        description: 'Manual order status refresh result',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Manual order status refreshed' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                message: { type: 'string', example: 'Manual order status refreshed' },
                                                easyParcelError: { type: 'string', nullable: true, example: null },
                                                order: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'integer', example: 101 },
                                                        orderNumber: { type: 'string', example: 'MANUAL-20260613150000-1234' },
                                                        awbNumber: { type: 'string', example: 'EP123456789MY' },
                                                        providerOrderNumber: { type: 'string', example: 'EP-ORDER-123' },
                                                        providerShipmentNumber: { type: 'string', example: 'SHP-123' },
                                                        parcelNumber: { type: 'string', example: 'PCL-123' },
                                                        shipmentStatus: { type: 'string', example: 'IN_TRANSIT' },
                                                        shipmentStatusLabel: { type: 'string', example: 'In Transit' },
                                                        rawProviderStatus: { type: 'string', example: 'In Transit' },
                                                        trackingUrl: { type: 'string', example: 'https://easyparcel.com/my/en/track/details/?awb=EP123456789MY' },
                                                        easyParcel: {
                                                            type: 'object',
                                                            nullable: true,
                                                            properties: {
                                                                awb: { type: 'string', example: 'EP123456789MY' },
                                                                orderNumber: { type: 'string', example: 'EP-ORDER-123' },
                                                                shipmentNumber: { type: 'string', example: 'SHP-123' },
                                                                parcelNumber: { type: 'string', example: 'PCL-123' },
                                                                trackingUrl: { type: 'string', example: 'https://easyparcel.com/my/en/track/details/?awb=EP123456789MY' },
                                                            },
                                                        },
                                                        statusHistory: {
                                                            type: 'array',
                                                            items: {
                                                                type: 'object',
                                                                properties: {
                                                                    oldStatus: { type: 'string', nullable: true, example: 'AWB_READY' },
                                                                    newStatus: { type: 'string', example: 'IN_TRANSIT' },
                                                                    rawProviderStatus: { type: 'string', example: 'In Transit' },
                                                                    note: { type: 'string', example: 'Status refreshed from EasyParcel tracking API' },
                                                                    createdAt: { type: 'string', format: 'date-time' },
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
                    401: { description: 'Unauthorized' },
                    404: { description: 'Manual order not found' },
                    502: { description: 'EasyParcel tracking request failed' },
                },
            },
        },
        '/order-management/manual-orders/aftership/config': {
            get: {
                tags: ['Manual Orders'],
                summary: 'Get AfterShip configuration status',
                description: 'Returns backend AfterShip settings for PH, VN, TH, ID, MY or SG without exposing the full API key.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'country', schema: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], default: 'MY' } },
                ],
                responses: {
                    200: {
                        description: 'AfterShip config status',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/AfterShipConfigStatus' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/order-management/manual-orders/aftership/api-key': {
            put: {
                tags: ['Manual Orders'],
                summary: 'Set AfterShip API key and defaults',
                description: 'Updates AfterShip API key and optional country defaults for the current server process. Set persist=true to save values into backend .env.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['apiKey'],
                                properties: {
                                    country: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], default: 'MY' },
                                    apiKey: { type: 'string', example: 'aftership_api_key' },
                                    shipperAccountId: { type: 'string', example: 'shipper-account-id' },
                                    courierSlug: { type: 'string', example: 'ninjavan-ph' },
                                    serviceType: { type: 'string', example: 'standard' },
                                    mode: { type: 'string', enum: ['sandbox', 'production'], default: 'sandbox' },
                                    persist: { type: 'boolean', default: false },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'AfterShip API key updated' },
                    400: { description: 'Missing API key or unsupported country' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/order-management/manual-orders/aftership/couriers': {
            get: {
                tags: ['Manual Orders'],
                summary: 'List AfterShip shipping couriers',
                description: 'Fetches couriers from AfterShip Shipping API for the configured account.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'country', schema: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], default: 'MY' } },
                ],
                responses: {
                    200: { description: 'AfterShip couriers returned' },
                    400: { description: 'AfterShip API key missing' },
                    401: { description: 'Unauthorized' },
                    502: { description: 'AfterShip request failed' },
                },
            },
        },
        '/order-management/manual-orders/aftership/shipper-accounts': {
            get: {
                tags: ['Manual Orders'],
                summary: 'List AfterShip shipper accounts',
                description: 'Fetches shipper accounts from AfterShip. A shipper account is normally required before creating rates or labels.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'country', schema: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], default: 'MY' } },
                    { in: 'query', name: 'slug', schema: { type: 'string', example: 'ninjavan-ph' } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', example: 50 } },
                    { in: 'query', name: 'nextToken', schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'AfterShip shipper accounts returned' },
                    400: { description: 'AfterShip API key missing' },
                    401: { description: 'Unauthorized' },
                    502: { description: 'AfterShip request failed' },
                },
            },
        },
        '/order-management/manual-orders/aftership/rates': {
            get: {
                tags: ['Manual Orders'],
                summary: 'Get AfterShip rates for manual order',
                description: 'Looks up AfterShip Shipping courier rates for PH, VN, TH, ID, MY or SG manual orders using sender/receiver address and parcel dimensions.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'warehouseId', schema: { type: 'integer', example: 1 } },
                    { in: 'query', name: 'senderCountry', schema: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], example: 'PH' } },
                    { in: 'query', name: 'senderPostcode', schema: { type: 'string', example: '1000' } },
                    { in: 'query', name: 'senderCity', schema: { type: 'string', example: 'Manila' } },
                    { in: 'query', name: 'senderState', schema: { type: 'string', example: 'Metro Manila' } },
                    { in: 'query', name: 'senderAddress', schema: { type: 'string', example: 'Warehouse address' } },
                    { in: 'query', name: 'sendCountry', schema: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], example: 'PH' } },
                    { in: 'query', name: 'postcode', schema: { type: 'string', example: '1100' } },
                    { in: 'query', name: 'city', schema: { type: 'string', example: 'Quezon City' } },
                    { in: 'query', name: 'state', schema: { type: 'string', example: 'Metro Manila' } },
                    { in: 'query', name: 'address', schema: { type: 'string', example: 'Receiver address' } },
                    { in: 'query', name: 'weight', schema: { type: 'number', example: 0.5 } },
                    { in: 'query', name: 'length', schema: { type: 'number', example: 10 } },
                    { in: 'query', name: 'width', schema: { type: 'number', example: 10 } },
                    { in: 'query', name: 'height', schema: { type: 'number', example: 10 } },
                    { in: 'query', name: 'parcelValue', schema: { type: 'number', example: 500 } },
                    { in: 'query', name: 'shipperAccountId', schema: { type: 'string', example: 'shipper-account-id' } },
                ],
                responses: {
                    200: {
                        description: 'AfterShip rates returned',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                configured: { type: 'boolean', example: true },
                                                originCountry: { type: 'string', example: 'PH' },
                                                currency: { type: 'string', example: 'PHP' },
                                                services: { type: 'array', items: { $ref: '#/components/schemas/AfterShipRate' } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid address or missing configuration' },
                    401: { description: 'Unauthorized' },
                    502: { description: 'AfterShip request failed' },
                },
            },
        },
        '/order-management/manual-orders/aftership/label-details': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Get AfterShip label details',
                description: 'Fetches live label details from AfterShip Shipping API by labelId.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['labelId'],
                                properties: {
                                    country: { type: 'string', enum: ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'], default: 'MY' },
                                    labelId: { type: 'string', example: 'aftership-label-id' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'AfterShip label details returned' },
                    400: { description: 'Missing labelId or API key' },
                    401: { description: 'Unauthorized' },
                    502: { description: 'AfterShip request failed' },
                },
            },
        },
        '/order-management/manual-orders/{id}/aftership/submit': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Submit saved manual order to AfterShip',
                description: 'Creates an AfterShip Shipping label for a saved manual order. Supports PH, VN, TH, ID, MY and SG based on the sender/warehouse country.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 101 }, description: 'Manual order ID.' },
                ],
                responses: {
                    200: { description: 'AfterShip label created or existing label returned' },
                    400: { description: 'Missing address, shipper account, service type, or API key' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Manual order not found' },
                    502: { description: 'AfterShip label request failed' },
                },
            },
        },
        '/order-management/manual-orders/{id}/aftership/status': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Refresh AfterShip tracking status',
                description: 'Creates/fetches an AfterShip Tracking record for the stored tracking number and updates the manual order status.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 101 }, description: 'Manual order ID.' },
                ],
                responses: {
                    200: { description: 'AfterShip status refreshed' },
                    400: { description: 'No tracking number or API key' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Manual order not found' },
                    502: { description: 'AfterShip tracking request failed' },
                },
            },
        },
        '/order-management/manual-orders/{id}/aftership/cancel': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Cancel AfterShip label',
                description: 'Cancels an AfterShip label before final delivery/return/cancellation and marks the manual order as cancelled.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 101 }, description: 'Manual order ID.' },
                ],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    reason: { type: 'string', example: 'Cancelled from ERP manual order' },
                                    remark: { type: 'string', example: 'Customer requested cancellation' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'AfterShip label cancelled' },
                    400: { description: 'Label cannot be cancelled or API key missing' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Manual order not found' },
                    502: { description: 'AfterShip cancel request failed' },
                },
            },
        },
        '/order-management/manual-orders/{id}/aftership/pickup': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Create AfterShip pickup',
                description: 'Creates a pickup request in AfterShip for the manual order label or pickup parcels.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 101 }, description: 'Manual order ID.' },
                ],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    pickupDate: { type: 'string', format: 'date', example: '2026-06-19' },
                                    pickupStartTime: { type: 'string', example: '09:00:00' },
                                    pickupEndTime: { type: 'string', example: '18:00:00' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'AfterShip pickup created' },
                    400: { description: 'Invalid pickup data or API key missing' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Manual order not found' },
                    502: { description: 'AfterShip pickup request failed' },
                },
            },
        },
        '/order-management/manual-orders/{id}/cod-settlement': {
            patch: {
                tags: ['Manual Orders'],
                summary: 'Update internal COD settlement for a manual order',
                description: 'Updates ERP-side COD payout/reconciliation fields after an admin verifies COD collection or payout in EasyParcel dashboard/report. EasyParcel OpenAPI does not expose COD payout settlement by shipment number.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'id', required: true, schema: { type: 'integer', example: 101 }, description: 'Manual order ID.' },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    codStatus: {
                                        type: 'string',
                                        enum: [
                                            'COD_PENDING_COLLECTION',
                                            'COD_COLLECTED_BY_COURIER',
                                            'COD_SETTLEMENT_PENDING',
                                            'COD_DELIVERED_PENDING_SETTLEMENT',
                                            'COD_READY_TO_PAYOUT',
                                            'COD_PAID_TO_COMPANY',
                                            'COD_FAILED_OR_RETURNED',
                                        ],
                                        example: 'COD_PAID_TO_COMPANY',
                                    },
                                    paidAmount: { type: 'number', example: 79 },
                                    settlementAmount: { type: 'number', example: 79 },
                                    paidAt: { type: 'string', format: 'date-time', example: '2026-06-14T10:30:00.000Z' },
                                    reference: { type: 'string', example: 'EP-COD-PAYOUT-20260614' },
                                    note: { type: 'string', example: 'Verified from EasyParcel COD dashboard.' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'COD settlement updated' },
                    400: { description: 'Invalid COD settlement update' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Manual order not found' },
                },
            },
        },
        '/order-management/platform-orders/pack-stock': {
            post: {
                tags: ['Manual Orders'],
                summary: 'Finalize packed stock for platform order',
                description: 'Converts previously reserved Shopee/TikTok platform order stock into packed/deducted stock for each order item and reduces mapped platform stock by the packed quantity using platform reduce-stock APIs.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['platform', 'order'],
                                properties: {
                                    platform: { type: 'string', enum: ['shopee', 'tiktok'], example: 'shopee' },
                                    context: {
                                        type: 'object',
                                        description: 'Optional platform store context used when order-level store identifiers are not present.',
                                        properties: {
                                            platform_store_id: { type: 'string', example: '123456' },
                                            shop_id: { type: 'string', example: '987654321' },
                                            platform_open_id: { type: 'string', example: 'open-id' },
                                            cipher: { type: 'string', example: 'cipher-id' },
                                        },
                                    },
                                    order: {
                                        type: 'object',
                                        required: ['items'],
                                        properties: {
                                            orderId: { type: 'string', example: '240624ABC123' },
                                            orderNo: { type: 'string', example: '240624ABC123' },
                                            externalStoreId: { type: 'string', example: '123456' },
                                            shopId: { type: 'string', example: '987654321' },
                                            openId: { type: 'string', example: 'open-id' },
                                            cipherId: { type: 'string', example: 'cipher-id' },
                                            warehouseId: { type: 'integer', example: 1 },
                                            locationId: { type: 'string', example: 'MY-WH-01' },
                                            items: {
                                                type: 'array',
                                                minItems: 1,
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        orderItemId: { type: 'string', example: 'item-001' },
                                                        itemId: { type: 'string', example: 'platform-item-001' },
                                                        productId: { type: 'string', example: 'platform-product-001' },
                                                        modelId: { type: 'string', example: 'platform-model-001' },
                                                        skuId: { type: 'string', example: 'platform-sku-001' },
                                                        listingId: { type: 'string', example: 'platform-listing-001' },
                                                        quantity: { type: 'integer', example: 2 },
                                                        warehouseId: { type: 'integer', example: 1 },
                                                        locationId: { type: 'string', example: 'MY-WH-01' },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            example: {
                                platform: 'shopee',
                                order: {
                                    orderId: '240624ABC123',
                                    shopId: '987654321',
                                    warehouseId: 1,
                                    items: [
                                        {
                                            orderItemId: 'item-001',
                                            itemId: 'platform-item-001',
                                            modelId: 'platform-model-001',
                                            quantity: 2,
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Packed stock finalized',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Packed stock finalized' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                count: { type: 'integer', example: 1 },
                                                results: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            itemId: { type: 'string', example: 'item-001' },
                                                            result: {
                                                                type: 'object',
                                                                properties: {
                                                                    platform: { type: 'string', example: 'shopee' },
                                                                    platformMappingId: { type: 'integer', example: 12 },
                                                                    syncMarkedOutOfSync: { type: 'integer', example: 1 },
                                                                    affectedMerchantSkuIds: {
                                                                        type: 'array',
                                                                        items: { type: 'integer' },
                                                                        example: [101],
                                                                    },
                                                                    platformStockSync: { type: 'object', nullable: true },
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
                    400: { description: 'Invalid platform or missing order items' },
                    401: { description: 'Unauthorized' },
                    404: { description: 'Platform SKU mapping/store not found' },
                    409: { description: 'Stock cannot be packed for the requested order item' },
                },
            },
        },
    },
};
