module.exports = {
    // ── Schemas ───────────────────────────────────────────────────────
    schemas: {
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
                avatar: { type: 'string', description: 'Base64 encoded image' },
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
                            },
                        },
                    },
                },
            },
        },
    },

    // ── Paths ─────────────────────────────────────────────────────────
    paths: {
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new company (creates admin account)',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
                responses: {
                    201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                    400: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    409: { description: 'Email already registered' },
                    429: { description: 'Rate limited' },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login — works for admin and sub accounts',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
                responses: {
                    200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                    401: { description: 'Invalid credentials' },
                    403: { description: 'Account deactivated' },
                    429: { description: 'Rate limited' },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout — kills session and blacklists token',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Logged out successfully' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
        '/auth/refresh-token': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } },
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
                summary: 'Get current authenticated user profile',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Profile fetched successfully' },
                    401: { description: 'Unauthorized' },
                },
            },
        },
    },
};