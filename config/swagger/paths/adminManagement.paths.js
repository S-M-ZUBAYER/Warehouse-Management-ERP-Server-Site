module.exports = {
    schemas: {
        AdminPlatformStoreUserStore: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 55 },
                storeName: { type: 'string', example: 'GROZZIIE TH' },
                externalStoreName: { type: 'string', nullable: true, example: 'GROZZIIE TH' },
                externalStoreId: { type: 'string', nullable: true, example: '7495574002249337724' },
                storeShopId: { type: 'string', nullable: true, example: '7495574002249337724' },
                country: { type: 'string', nullable: true, example: 'TH' },
                isActive: { type: 'boolean', example: true },
                createdAt: { type: 'string', format: 'date-time', nullable: true },
                subscriptionStatus: { type: 'string', nullable: true, example: 'active' },
                subscriptionLabel: { type: 'string', nullable: true, example: 'active' },
                expiresAt: { type: 'string', format: 'date-time', nullable: true },
                remainingDays: { type: 'integer', nullable: true, example: 104 },
                currentPlan: { type: 'string', nullable: true, example: 'Basic' },
                currentPlanCode: { type: 'string', nullable: true, example: 'basic' },
            },
        },
        AdminPlatformStoreUser: {
            type: 'object',
            properties: {
                companyId: { type: 'integer', example: 1 },
                companyName: { type: 'string', nullable: true, example: 'Zubayer' },
                companyEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                companyStatus: { type: 'string', nullable: true, example: 'trial' },
                userId: { type: 'integer', nullable: true, example: 1 },
                email: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                name: { type: 'string', nullable: true, example: 'Charli' },
                role: { type: 'string', nullable: true, example: 'owner' },
                platform: { type: 'string', enum: ['tiktok', 'shopee'], example: 'tiktok' },
                storeCount: { type: 'integer', example: 2 },
                storeNames: { type: 'array', items: { type: 'string' }, example: ['TIMOZIA', 'GROZZIIE TH'] },
                storeIds: { type: 'array', items: { type: 'integer' }, example: [55, 74] },
                countries: { type: 'array', items: { type: 'string' }, example: ['MY', 'TH'] },
                latestExpiryAt: { type: 'string', format: 'date-time', nullable: true },
                stores: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AdminPlatformStoreUserStore' },
                },
            },
        },
        AdminPlatformTransaction: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                paymentUid: { type: 'string', example: 'PAY-...' },
                paymentGroupUid: { type: 'string', example: 'PGRP-...' },
                platform: { type: 'string', enum: ['tiktok', 'shopee'], example: 'tiktok' },
                storeId: { type: 'integer', nullable: true, example: 74 },
                storeName: { type: 'string', nullable: true, example: 'TIMOZIA' },
                externalStoreId: { type: 'string', nullable: true, example: '7494665603559885775' },
                storeShopId: { type: 'string', nullable: true, example: '7494665603559885775' },
                country: { type: 'string', nullable: true, example: 'MY' },
                companyId: { type: 'integer', nullable: true, example: 1 },
                companyName: { type: 'string', nullable: true, example: 'Zubayer' },
                companyEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                purchaserUserId: { type: 'integer', nullable: true, example: 1 },
                purchaserUserName: { type: 'string', nullable: true, example: 'Charli' },
                purchaserUserEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                purchaserEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                planName: { type: 'string', nullable: true, example: 'Pro' },
                planCode: { type: 'string', nullable: true, example: 'pro' },
                amount: { type: 'number', example: 99 },
                currency: { type: 'string', nullable: true, example: 'MYR' },
                paymentProvider: { type: 'string', nullable: true, example: 'stripe' },
                paymentStatus: { type: 'string', nullable: true, example: 'succeeded' },
                paidAt: { type: 'string', format: 'date-time', nullable: true },
                transactionAt: { type: 'string', format: 'date-time', nullable: true },
                previousExpiry: { type: 'string', format: 'date-time', nullable: true },
                newExpiry: { type: 'string', format: 'date-time', nullable: true },
                couponCode: { type: 'string', nullable: true, example: 'ABC123' },
                redeemedCouponCode: { type: 'string', nullable: true, example: 'XYZ789' },
                createdAt: { type: 'string', format: 'date-time', nullable: true },
            },
        },
        AdminPlatformTransactionSummary: {
            type: 'object',
            properties: {
                totalTransactions: { type: 'integer', example: 10 },
                totalAmount: { type: 'number', example: 500 },
                currencyBreakdown: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            currency: { type: 'string', example: 'MYR' },
                            amount: { type: 'number', example: 300 },
                            transactions: { type: 'integer', example: 6 },
                        },
                    },
                },
                platforms: {
                    type: 'object',
                    properties: {
                        tiktok: {
                            type: 'object',
                            properties: {
                                transactions: { type: 'integer', example: 7 },
                                amount: { type: 'number', example: 350 },
                                currencyBreakdown: { type: 'array', items: { type: 'object' } },
                            },
                        },
                        shopee: {
                            type: 'object',
                            properties: {
                                transactions: { type: 'integer', example: 3 },
                                amount: { type: 'number', example: 150 },
                                currencyBreakdown: { type: 'array', items: { type: 'object' } },
                            },
                        },
                    },
                },
            },
        },
        AdminShippingWalletPayment: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 12 },
                ledgerId: { type: 'integer', example: 12 },
                companyId: { type: 'integer', example: 1 },
                companyName: { type: 'string', nullable: true, example: 'Zubayer' },
                companyEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                ownerUserId: { type: 'integer', nullable: true, example: 1 },
                ownerName: { type: 'string', nullable: true, example: 'Charli' },
                ownerEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                customerUserId: { type: 'integer', nullable: true, example: 1 },
                customerName: { type: 'string', nullable: true, example: 'Charli' },
                customerEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                walletId: { type: 'integer', nullable: true, example: 4 },
                walletBalanceMyr: { type: 'number', example: 200 },
                transactionType: { type: 'string', example: 'topup' },
                type: { type: 'string', example: 'topup' },
                status: { type: 'string', nullable: true, example: 'paid' },
                paidAmount: { type: 'number', nullable: true, example: 50 },
                paidCurrency: { type: 'string', nullable: true, example: 'MYR' },
                originalAmount: { type: 'number', nullable: true, example: 50 },
                originalCurrency: { type: 'string', nullable: true, example: 'MYR' },
                fxRateToMyr: { type: 'number', nullable: true, example: 1 },
                grossMyrAmount: { type: 'number', example: 52.1 },
                creditedMyrAmount: { type: 'number', example: 50 },
                amountMyr: { type: 'number', example: 50 },
                feeOrReserveMyr: { type: 'number', example: 2.1 },
                balanceBeforeMyr: { type: 'number', example: 150 },
                balanceAfterMyr: { type: 'number', example: 200 },
                provider: { type: 'string', nullable: true, example: 'stripe' },
                paymentProvider: { type: 'string', nullable: true, example: 'stripe' },
                reference: { type: 'string', nullable: true, example: 'cs_test_...' },
                stripeSessionId: { type: 'string', nullable: true, example: 'cs_test_...' },
                stripePaymentIntentId: { type: 'string', nullable: true, example: 'pi_...' },
                stripeAmountTotal: { type: 'integer', nullable: true, example: 5000 },
                stripeCurrency: { type: 'string', nullable: true, example: 'myr' },
                fxSource: { type: 'string', nullable: true, example: 'exchangerate.host' },
                createdAt: { type: 'string', format: 'date-time', nullable: true },
                paidAt: { type: 'string', format: 'date-time', nullable: true },
                metadata: { type: 'object' },
            },
        },
        AdminShippingWalletPaymentSummary: {
            type: 'object',
            properties: {
                totalTopUps: { type: 'integer', example: 8 },
                totalPaidOriginal: {
                    type: 'object',
                    example: { MYR: 200, USD: 30, SGD: 10 },
                },
                originalCurrencyBreakdown: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            currency: { type: 'string', example: 'MYR' },
                            amount: { type: 'number', example: 200 },
                            transactions: { type: 'integer', example: 4 },
                        },
                    },
                },
                totalGrossMyr: { type: 'number', example: 390.62 },
                totalCreditedMyr: { type: 'number', example: 374.12 },
                totalFeeOrReserveMyr: { type: 'number', example: 16.5 },
                statusBreakdown: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            status: { type: 'string', example: 'paid' },
                            transactions: { type: 'integer', example: 8 },
                            creditedMyrAmount: { type: 'number', example: 374.12 },
                        },
                    },
                },
            },
        },
        AdminGiftHistory: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 1 },
                previousStatus: { type: 'string', nullable: true, example: 'pending_address' },
                status: { type: 'string', example: 'address_submitted' },
                changedByUserId: { type: 'integer', nullable: true, example: 1 },
                changedByName: { type: 'string', nullable: true, example: 'Charli' },
                changedByEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                note: { type: 'string', nullable: true, example: 'Gift shipped by admin' },
                trackingNumber: { type: 'string', nullable: true, example: 'TRACK123456' },
                createdAt: { type: 'string', format: 'date-time', nullable: true },
            },
        },
        AdminGift: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 4 },
                status: { type: 'string', example: 'address_submitted' },
                ownerUserId: { type: 'integer', nullable: true, example: 48 },
                ownerEmail: { type: 'string', nullable: true, example: 'mahaditht@gmail.com' },
                ownerName: { type: 'string', nullable: true, example: 'Mahadi' },
                ownerCompanyId: { type: 'integer', nullable: true, example: 126 },
                ownerCompanyName: { type: 'string', nullable: true, example: 'Mahadi' },
                redeemerEmail: { type: 'string', nullable: true, example: 'smzubayer9004@gmail.com' },
                couponCode: { type: 'string', nullable: true, example: '311197' },
                sourcePaymentUid: { type: 'string', nullable: true, example: 'pi_...' },
                sourcePlanName: { type: 'string', nullable: true, example: 'Pro' },
                sourceAmount: { type: 'number', nullable: true, example: 9 },
                sourceCurrency: { type: 'string', nullable: true, example: 'USD' },
                recipientName: { type: 'string', nullable: true, example: 'Mahadin' },
                recipientPhone: { type: 'string', nullable: true, example: '0123456789' },
                address: { type: 'string', nullable: true, example: 'saidpur nilphamari' },
                city: { type: 'string', nullable: true, example: 'Saidpur' },
                country: { type: 'string', nullable: true, example: 'Bangladesh' },
                zipCode: { type: 'string', nullable: true, example: '5300' },
                trackingNumber: { type: 'string', nullable: true, example: 'TRACK123456' },
                modalSeenAt: { type: 'string', format: 'date-time', nullable: true },
                createdAt: { type: 'string', format: 'date-time', nullable: true },
                updatedAt: { type: 'string', format: 'date-time', nullable: true },
            },
        },
        AdminGiftDetail: {
            allOf: [
                { $ref: '#/components/schemas/AdminGift' },
                {
                    type: 'object',
                    properties: {
                        owner: { type: 'object' },
                        redeemer: { type: 'object' },
                        coupon: { type: 'object' },
                        redemption: { type: 'object' },
                        sourcePayment: { type: 'object' },
                        delivery: { type: 'object' },
                        history: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/AdminGiftHistory' },
                        },
                    },
                },
            ],
        },
        AdminGiftSummary: {
            type: 'object',
            properties: {
                total: { type: 'integer', example: 10 },
                pending_address: { type: 'integer', example: 2 },
                address_submitted: { type: 'integer', example: 3 },
                on_the_way: { type: 'integer', example: 1 },
                shipped: { type: 'integer', example: 1 },
                delivered: { type: 'integer', example: 1 },
                received: { type: 'integer', example: 1 },
                declined: { type: 'integer', example: 1 },
                cancelled: { type: 'integer', example: 0 },
            },
        },
    },
    paths: {
        '/admin/platform-store-users': {
            get: {
                tags: ['Admin Management'],
                summary: 'List ERP companies/users with connected stores by platform',
                description: [
                    'Protected admin-management endpoint for external ERP admin dashboards.',
                    'Requires a valid ERP Bearer token, owner/admin role, and logged-in email included in ADMIN_MANAGEMENT_EMAILS.',
                    'Rows are grouped by company for the selected platform and include store subscription status/expiry.',
                ].join(' '),
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        in: 'query',
                        name: 'platform',
                        schema: { type: 'string', enum: ['tiktok', 'shopee'], default: 'tiktok' },
                        description: 'Marketplace platform to inspect.',
                    },
                    {
                        in: 'query',
                        name: 'search',
                        schema: { type: 'string', maxLength: 150 },
                        description: 'Search by user email/name, company name/email, store name, external store ID, or shop ID.',
                    },
                    {
                        in: 'query',
                        name: 'startDate',
                        schema: { type: 'string', format: 'date' },
                        description: 'Filter stores created on or after this date.',
                    },
                    {
                        in: 'query',
                        name: 'endDate',
                        schema: { type: 'string', format: 'date' },
                        description: 'Filter stores created on or before this date.',
                    },
                    {
                        in: 'query',
                        name: 'page',
                        schema: { type: 'integer', minimum: 1, default: 1 },
                    },
                    {
                        in: 'query',
                        name: 'limit',
                        schema: { type: 'integer', minimum: 1, maximum: 500, default: 20 },
                    },
                    {
                        in: 'query',
                        name: 'export',
                        schema: { type: 'boolean', default: false },
                        description: 'When true, returns all filtered rows without pagination slicing for frontend Excel export.',
                    },
                    {
                        in: 'query',
                        name: 'includeDeleted',
                        schema: { type: 'boolean', default: false },
                        description: 'Include soft-deleted platform stores.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Grouped platform store users fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/PaginatedResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'array',
                                                    items: { $ref: '#/components/schemas/AdminPlatformStoreUser' },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Missing or invalid Bearer token' },
                    403: { description: 'Logged-in user is not allowed to use admin management APIs' },
                    500: { description: 'ADMIN_MANAGEMENT_EMAILS is not configured' },
                },
            },
        },
        '/admin/platform-transactions': {
            get: {
                tags: ['Admin Management'],
                summary: 'List ERP subscription/payment transactions by platform',
                description: [
                    'Protected admin-management endpoint for transaction reporting.',
                    'Requires a valid ERP Bearer token, owner/admin role, and logged-in email included in ADMIN_MANAGEMENT_EMAILS.',
                    'Returns transaction rows plus platform-wise and total currency summaries.',
                ].join(' '),
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        in: 'query',
                        name: 'platform',
                        schema: { type: 'string', enum: ['all', 'tiktok', 'shopee'], default: 'all' },
                        description: 'Marketplace platform filter.',
                    },
                    {
                        in: 'query',
                        name: 'search',
                        schema: { type: 'string', maxLength: 150 },
                        description: 'Search payment IDs, purchaser email, company, user, store, plan, or coupon.',
                    },
                    {
                        in: 'query',
                        name: 'startDate',
                        schema: { type: 'string', format: 'date' },
                        description: 'Filter transactions paid/created on or after this date.',
                    },
                    {
                        in: 'query',
                        name: 'endDate',
                        schema: { type: 'string', format: 'date' },
                        description: 'Filter transactions paid/created on or before this date.',
                    },
                    {
                        in: 'query',
                        name: 'page',
                        schema: { type: 'integer', minimum: 1, default: 1 },
                    },
                    {
                        in: 'query',
                        name: 'limit',
                        schema: { type: 'integer', minimum: 1, maximum: 500, default: 20 },
                    },
                    {
                        in: 'query',
                        name: 'export',
                        schema: { type: 'boolean', default: false },
                        description: 'When true, returns all filtered rows without pagination slicing for frontend Excel export.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Platform transactions fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/PaginatedResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'object',
                                                    properties: {
                                                        rows: {
                                                            type: 'array',
                                                            items: { $ref: '#/components/schemas/AdminPlatformTransaction' },
                                                        },
                                                        summary: { $ref: '#/components/schemas/AdminPlatformTransactionSummary' },
                                                        filters: { type: 'object' },
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Missing or invalid Bearer token' },
                    403: { description: 'Logged-in user is not allowed to use admin management APIs' },
                    500: { description: 'ADMIN_MANAGEMENT_EMAILS is not configured' },
                },
            },
        },
        '/admin/manual-order-shipping-wallet/payments': {
            get: {
                tags: ['Admin Management'],
                summary: 'List manual order shipping wallet top-up payments',
                description: [
                    'Protected admin-management endpoint for manual order shipping wallet payment reporting.',
                    'Requires a valid ERP Bearer token, owner/admin role, and logged-in email included in ADMIN_MANAGEMENT_EMAILS.',
                    'Returns top-up ledger rows with company, owner, payer, paid currency, credited MYR amount, Stripe references, and totals.',
                ].join(' '),
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        in: 'query',
                        name: 'search',
                        schema: { type: 'string', maxLength: 150 },
                        description: 'Search company, owner/payer name or email, provider, ledger ID, Stripe session ID, or payment intent ID.',
                    },
                    {
                        in: 'query',
                        name: 'email',
                        schema: { type: 'string', maxLength: 150 },
                        description: 'Email search alias. Use search for combined filtering.',
                    },
                    {
                        in: 'query',
                        name: 'companyId',
                        schema: { type: 'integer', minimum: 1 },
                        description: 'Filter payments for one ERP company.',
                    },
                    {
                        in: 'query',
                        name: 'currency',
                        schema: { type: 'string', example: 'MYR' },
                        description: 'Filter by original paid currency. Use all or omit for every currency.',
                    },
                    {
                        in: 'query',
                        name: 'status',
                        schema: { type: 'string', example: 'paid' },
                        description: 'Filter by wallet ledger payment status. Use all or omit for every status.',
                    },
                    {
                        in: 'query',
                        name: 'startDate',
                        schema: { type: 'string', format: 'date' },
                        description: 'Filter payments created on or after this date.',
                    },
                    {
                        in: 'query',
                        name: 'endDate',
                        schema: { type: 'string', format: 'date' },
                        description: 'Filter payments created on or before this date.',
                    },
                    {
                        in: 'query',
                        name: 'dateFrom',
                        schema: { type: 'string', format: 'date' },
                        description: 'Alias for startDate.',
                    },
                    {
                        in: 'query',
                        name: 'dateTo',
                        schema: { type: 'string', format: 'date' },
                        description: 'Alias for endDate.',
                    },
                    {
                        in: 'query',
                        name: 'page',
                        schema: { type: 'integer', minimum: 1, default: 1 },
                    },
                    {
                        in: 'query',
                        name: 'limit',
                        schema: { type: 'integer', minimum: 1, maximum: 500, default: 20 },
                    },
                    {
                        in: 'query',
                        name: 'export',
                        schema: { type: 'boolean', default: false },
                        description: 'When true, returns all filtered rows without pagination slicing for frontend Excel export.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Shipping wallet payments fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/PaginatedResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'object',
                                                    properties: {
                                                        rows: {
                                                            type: 'array',
                                                            items: { $ref: '#/components/schemas/AdminShippingWalletPayment' },
                                                        },
                                                        summary: { $ref: '#/components/schemas/AdminShippingWalletPaymentSummary' },
                                                        filters: { type: 'object' },
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Missing or invalid Bearer token' },
                    403: { description: 'Logged-in user is not allowed to use admin management APIs' },
                    500: { description: 'ADMIN_MANAGEMENT_EMAILS is not configured' },
                },
            },
        },
        '/admin/gifts': {
            get: {
                tags: ['Admin Management'],
                summary: 'List referral gifts for admin management',
                description: 'Protected cross-company gift management list with search, status/date/country filters, summaries, and export mode.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        in: 'query',
                        name: 'status',
                        schema: {
                            type: 'string',
                            enum: ['all', 'pending_address', 'address_submitted', 'processing', 'on_the_way', 'shipped', 'delivered', 'received', 'declined', 'cancelled'],
                            default: 'all',
                        },
                    },
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 150 } },
                    { in: 'query', name: 'country', schema: { type: 'string', maxLength: 80 } },
                    { in: 'query', name: 'startDate', schema: { type: 'string', format: 'date' } },
                    { in: 'query', name: 'endDate', schema: { type: 'string', format: 'date' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 500, default: 20 } },
                    {
                        in: 'query',
                        name: 'export',
                        schema: { type: 'boolean', default: false },
                        description: 'When true, returns all filtered rows without pagination slicing for frontend Excel export.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Admin gifts fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/PaginatedResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'object',
                                                    properties: {
                                                        rows: {
                                                            type: 'array',
                                                            items: { $ref: '#/components/schemas/AdminGift' },
                                                        },
                                                        summary: { $ref: '#/components/schemas/AdminGiftSummary' },
                                                        filters: { type: 'object' },
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Validation failed' },
                    401: { description: 'Missing or invalid Bearer token' },
                    403: { description: 'Logged-in user is not allowed to use admin management APIs' },
                },
            },
        },
        '/admin/gifts/{giftId}': {
            get: {
                tags: ['Admin Management'],
                summary: 'Get one referral gift detail',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'giftId', required: true, schema: { type: 'integer', minimum: 1 } },
                ],
                responses: {
                    200: {
                        description: 'Admin gift fetched successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/SuccessResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: { $ref: '#/components/schemas/AdminGiftDetail' },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    404: { description: 'Gift not found' },
                },
            },
        },
        '/admin/gifts/{giftId}/status': {
            patch: {
                tags: ['Admin Management'],
                summary: 'Update referral gift delivery status',
                description: 'Admin may set shipped/on_the_way, delivered, or cancelled. Customer receipt confirmation remains in the normal user gift flow.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'path', name: 'giftId', required: true, schema: { type: 'integer', minimum: 1 } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['status'],
                                properties: {
                                    status: { type: 'string', enum: ['shipped', 'on_the_way', 'delivered', 'cancelled'] },
                                    trackingNumber: { type: 'string', maxLength: 120, example: 'TRACK123456' },
                                    note: { type: 'string', maxLength: 1000, example: 'Gift shipped by admin' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Gift status updated successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/SuccessResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: { $ref: '#/components/schemas/AdminGiftDetail' },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Invalid status transition' },
                    404: { description: 'Gift not found' },
                },
            },
        },
    },
};
