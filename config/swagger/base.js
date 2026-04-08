require('dotenv').config();

module.exports = {
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
            // ── Generic reusable schemas only ────────────────────────────
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
        },
    },
    security: [{ bearerAuth: [] }],
    tags: [
        { name: 'Auth', description: 'Authentication & session management' },
        { name: 'Users', description: 'Sub-account management' },
        { name: 'Pages', description: 'Web pages management' },
        { name: 'Roles', description: 'Role & permission management' },
        { name: 'Warehouses', description: 'Warehouse setup & zones' },
        { name: 'Merchant SKUs', description: 'Merchant SKU management' },
        { name: 'Combine SKUs', description: 'Bundle / combine SKU management' },
        // ✅ Just add a new line here for each new module
    ],
};