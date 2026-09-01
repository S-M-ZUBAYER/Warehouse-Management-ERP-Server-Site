module.exports = {
    schemas: {
        PricingPlan: {
            type: 'object',
            properties: {
                id: { type: 'integer', example: 2 },
                name: { type: 'string', example: 'Basic' },
                code: { type: 'string', example: 'basic' },
                durationDays: { type: 'integer', example: 90 },
                currency: { type: 'string', example: 'USD' },
                amount: { type: 'number', example: 3 },
                badgeLabel: { type: 'string', nullable: true, example: 'Popular' },
                features: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            serialNo: { type: 'integer', example: 1 },
                            title: { type: 'string', example: '90 days subscription duration' },
                            description: { type: 'string' },
                        },
                    },
                },
            },
        },
        DemoCheckoutRequest: {
            type: 'object',
            required: ['planCode'],
            properties: {
                planCode: { type: 'string', example: 'basic' },
                country: { type: 'string', example: 'US' },
                currency: { type: 'string', example: 'USD' },
                storeIds: { type: 'array', items: { type: 'integer' }, example: [12] },
                couponCode: {
                    type: 'string',
                    example: '483920',
                    description: 'Optional referral code. Redeemable only when the purchaser company/user has no previous paid plan purchase and the selected plan is one year or two years.',
                },
            },
        },
        StripeCheckoutSessionResult: {
            type: 'object',
            properties: {
                sessionId: { type: 'string', example: 'cs_test_a1...' },
                checkoutUrl: { type: 'string', example: 'https://checkout.stripe.com/c/pay/cs_test_a1...' },
                paymentProvider: { type: 'string', example: 'stripe' },
                paymentStatus: { type: 'string', example: 'unpaid' },
                amount: { type: 'number', example: 3 },
                currency: { type: 'string', example: 'USD' },
                expiresAt: { type: 'string', format: 'date-time' },
            },
        },
        StripeCheckoutCompleteRequest: {
            type: 'object',
            required: ['sessionId'],
            properties: {
                sessionId: { type: 'string', example: 'cs_test_a1...' },
            },
        },
        SubscriptionCheckoutResult: {
            type: 'object',
            properties: {
                paymentId: { type: 'string', example: 'cs_test_a1...' },
                paymentProvider: { type: 'string', example: 'stripe' },
                paymentStatus: { type: 'string', example: 'succeeded' },
                couponCode: { type: 'string', example: '483920', description: 'First generated referral code for backward compatibility.' },
                couponCodes: {
                    type: 'array',
                    description: 'One generated referral code per paid store in this checkout.',
                    items: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', example: '483920' },
                            paymentId: { type: 'integer', example: 31 },
                            storeSubscriptionId: { type: 'integer', example: 12 },
                            platformStoreId: { type: 'integer', example: 18 },
                        },
                    },
                },
                amount: { type: 'number', example: 3 },
                currency: { type: 'string', example: 'USD' },
            },
        },
        ReferralEligibilityRequest: {
            type: 'object',
            properties: {
                planCode: { type: 'string', example: 'standard' },
                planName: { type: 'string', example: 'Standard' },
                durationDays: { type: 'integer', example: 365 },
                country: { type: 'string', example: 'US' },
                currency: { type: 'string', example: 'USD' },
                storeIds: { type: 'array', items: { type: 'integer' }, example: [12] },
                platformStoreIds: { type: 'array', items: { type: 'integer' }, example: [12] },
            },
        },
        ReferralEligibilityResult: {
            type: 'object',
            properties: {
                eligible: { type: 'boolean', example: true },
                reason: { type: 'string', nullable: true, example: null },
                storeCount: { type: 'integer', example: 1 },
            },
        },
        GiftAddressRequest: {
            type: 'object',
            required: ['address'],
            properties: {
                address: {
                    type: 'object',
                    required: ['fullName', 'phone', 'addressLine1', 'zipCode', 'city', 'country'],
                    properties: {
                        fullName: { type: 'string', example: 'Maha Dith' },
                        phone: { type: 'string', example: '+8801000000000' },
                        addressLine1: { type: 'string', example: 'House 1, Road 2' },
                        addressLine2: { type: 'string', example: 'Apt 3' },
                        zipCode: { type: 'string', example: '1207' },
                        city: { type: 'string', example: 'Dhaka' },
                        state: { type: 'string', example: 'Dhaka' },
                        postalCode: { type: 'string', example: '1207', description: 'Backward-compatible alias of zipCode.' },
                        country: { type: 'string', example: 'Bangladesh' },
                    },
                },
            },
        },
    },
    paths: {
        '/pricing': {
            get: {
                tags: ['Pricing & Subscription'],
                summary: 'Get localized pricing plans',
                parameters: [
                    { in: 'query', name: 'country', schema: { type: 'string', example: 'US' } },
                    { in: 'query', name: 'language', schema: { type: 'string', example: 'en' } },
                    { in: 'query', name: 'currency', schema: { type: 'string', example: 'USD' } },
                ],
                responses: {
                    200: {
                        description: 'Pricing data',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/SuccessResponse' },
                                        {
                                            type: 'object',
                                            properties: {
                                                data: {
                                                    type: 'object',
                                                    properties: {
                                                        plans: { type: 'array', items: { $ref: '#/components/schemas/PricingPlan' } },
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },
        '/subscription/checkout': {
            post: {
                tags: ['Pricing & Subscription'],
                summary: 'Create a Stripe Checkout session for subscription payment',
                description: 'Creates a Stripe-hosted payment session. After Stripe redirects back to the success page, call /subscription/checkout/complete with the Stripe session ID to confirm payment and activate subscriptions. Referral coupon redemption is accepted only for a first paid plan purchase by the company/user, only when the selected plan duration is one year or two years, and only when none of this company authorized marketplace stores already has a paid plan purchase.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/DemoCheckoutRequest' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Stripe Checkout session created',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/SuccessResponse' },
                                        { type: 'object', properties: { data: { $ref: '#/components/schemas/StripeCheckoutSessionResult' } } },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Validation or coupon eligibility failure' },
                },
            },
        },
        '/subscription/checkout/complete': {
            post: {
                tags: ['Pricing & Subscription'],
                summary: 'Confirm Stripe Checkout payment and activate subscriptions',
                description: 'Retrieves the Stripe Checkout session, verifies ownership and paid status, then activates the selected store subscriptions and creates referral codes.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/StripeCheckoutCompleteRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Stripe payment confirmed',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/SuccessResponse' },
                                        { type: 'object', properties: { data: { $ref: '#/components/schemas/SubscriptionCheckoutResult' } } },
                                    ],
                                },
                            },
                        },
                    },
                    400: { description: 'Stripe session is invalid or payment is not complete' },
                    403: { description: 'Stripe session does not belong to current user/company' },
                },
            },
        },
        '/subscription/payments': {
            get: {
                tags: ['Pricing & Subscription'],
                summary: 'List current company subscription payment history',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { in: 'query', name: 'platformStoreId', schema: { type: 'integer' } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', example: 50 } },
                ],
                responses: { 200: { description: 'Payment history fetched' } },
            },
        },
        '/subscription/referral-eligibility': {
            post: {
                tags: ['Pricing & Subscription'],
                summary: 'Check whether checkout may show referral-code entry',
                description: 'Returns eligible only when the selected plan is one year or two years, the current company/user has no previous paid plan purchase, and none of this company authorized marketplace stores already has a paid plan purchase.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ReferralEligibilityRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Referral eligibility checked',
                        content: {
                            'application/json': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/SuccessResponse' },
                                        { type: 'object', properties: { data: { $ref: '#/components/schemas/ReferralEligibilityResult' } } },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },
        '/subscription/coupons': {
            get: {
                tags: ['Pricing & Subscription'],
                summary: 'List coupon codes owned by current company',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Coupons fetched' } },
            },
        },
        '/subscription/coupons/validate': {
            post: {
                tags: ['Pricing & Subscription'],
                summary: 'Validate coupon eligibility for checkout',
                description: 'Requires plan context to confirm the referral code is used on a one-year or two-year plan, by a company/user making its first paid plan purchase, and when none of this company authorized marketplace stores already has a paid plan purchase.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['couponCode'],
                                properties: {
                                    couponCode: { type: 'string', example: '483920' },
                                    planCode: { type: 'string', example: 'standard' },
                                    planName: { type: 'string', example: 'Standard' },
                                    durationDays: { type: 'integer', example: 365 },
                                    country: { type: 'string', example: 'US' },
                                    currency: { type: 'string', example: 'USD' },
                                    storeIds: { type: 'array', items: { type: 'integer' }, example: [12] },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Coupon validation completed' } },
            },
        },
        '/subscription/gifts': {
            get: {
                tags: ['Gifts'],
                summary: 'List gifts for current company',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Gifts fetched' } },
            },
        },
        '/subscription/gifts/count': {
            get: {
                tags: ['Gifts'],
                summary: 'Get unread gift notification count',
                security: [{ bearerAuth: [] }],
                responses: { 200: { description: 'Gift count fetched' } },
            },
        },
        '/subscription/gifts/{id}': {
            get: {
                tags: ['Gifts'],
                summary: 'Get gift details',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Gift fetched' }, 404: { description: 'Gift not found' } },
            },
        },
        '/subscription/gifts/{id}/seen': {
            patch: {
                tags: ['Gifts'],
                summary: 'Mark first gift modal as seen',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Gift marked as seen' } },
            },
        },
        '/subscription/gifts/{id}/address': {
            put: {
                tags: ['Gifts'],
                summary: 'Submit or update gift delivery address',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/GiftAddressRequest' } } },
                },
                responses: { 200: { description: 'Gift address submitted' } },
            },
        },
        '/subscription/gifts/{id}/decline': {
            patch: {
                tags: ['Gifts'],
                summary: 'Decline a gift permanently',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Gift declined' } },
            },
        },
        '/subscription/gifts/{id}/received': {
            patch: {
                tags: ['Gifts'],
                summary: 'Confirm gift received',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                responses: { 200: { description: 'Gift receipt confirmed' } },
            },
        },
        '/subscription/gifts/{id}/status': {
            patch: {
                tags: ['Gifts'],
                summary: 'Admin/staff update gift operational status',
                security: [{ bearerAuth: [] }],
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['status'],
                                properties: {
                                    status: { type: 'string', enum: ['ON_THE_WAY', 'DELIVERED', 'CANCELLED'] },
                                    trackingNumber: { type: 'string' },
                                    note: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: { 200: { description: 'Gift status updated' } },
            },
        },
    },
};
