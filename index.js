// 1. Load environment variables FIRST — before anything else
require('dotenv').config();

// 2. Core imports
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const os = require('os');

// 3. Internal imports
const { connectDB } = require('./config/database');
// const swaggerSpec = require('./config/swagger');
const swaggerSpec = require('./config/swagger/index');
const { apiLimiter } = require('./config/rateLimiter');

// 4. App init
const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const getLocalIpAddress = () => {
    const interfaces = os.networkInterfaces();

    for (const addresses of Object.values(interfaces)) {
        for (const address of addresses || []) {
            if (address.family === 'IPv4' && !address.internal) {
                return address.address;
            }
        }
    }

    return 'localhost';
};

// 5. Security & utility middlewares
// app.use(helmet());
app.use(
    helmet({
        contentSecurityPolicy: false,
    })
);
app.use(compression());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 6. CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, curl)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS: Origin "${origin}" not allowed`));
            }
        },
        credentials: true,
    })
);

// 7. Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 8. Static file serving for uploads
app.use('/uploads', express.static(process.env.UPLOAD_PATH || './uploads'));

// 9. Swagger UI — accessible at /api-docs (no auth required)
app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: `${process.env.APP_NAME || 'Grozziie ERP'} API Docs`,
        customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .topbar .topbar-wrapper img { display: none; }
    `,
        swaggerOptions: {
            persistAuthorization: true, // Keeps JWT across page reloads
        },
    })
);

// 10. Health check — no rate limit, no auth
app.get('/health', (_req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// Public Shopee order deduction callback: no auth and no rate limiter.
app.use(
    '/api/v1/platform-order-deductions/shopee',
    require('./modules/platformOrderDeductions/platformOrderDeductions.routes').publicShopeeRouter
);
app.use(
    '/api/v1/platform-order-deductions/tiktok',
    require('./modules/platformOrderDeductions/platformOrderDeductions.routes').publicTikTokRouter
);
const platformStoresRoutes = require('./modules/platformStores/platformStores.routes');
const platformStoresController = require('./modules/platformStores/platformStores.controller');
app.get(
    '/api/v1/platform-stores/public/by-shop-id',
    platformStoresRoutes.byShopIdValidator,
    platformStoresController.getPublicPlatformStoreByShopId
);

// 11. Rate limiting on all API routes
app.use('/api', apiLimiter);

// 12. Mount all API routes
const routes = require('./routes/index');
app.use('/api/v1', routes);

// Temporary placeholder until routes are built
app.get('/api/v1', (_req, res) => {
    res.json({
        success: true,
        message: `Welcome to ${process.env.APP_NAME || 'Grozziie ERP'} API v1`,
        docs: `${process.env.APP_URL || 'http://localhost:5000'}/api-docs`,
    });
});

// 13. 404 handler — must be after all routes
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found`,
    });
});

// 14. Global error handler — must be last
app.use((err, _req, res, _next) => {
    console.error('❌ Unhandled error:', err.message);

    // CORS error
    if (err.message.startsWith('CORS:')) {
        return res.status(403).json({ success: false, message: err.message });
    }

    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// 15. Connect to DB then start server
// const start = async () => {
//     await connectDB();

//     const localIp = process.env.APP_URL?.replace('http://', '').replace(`:${PORT}`, '');

//     app.listen(PORT, HOST, () => {
//         console.log(`Host: ${HOST}`);
//         console.log(`API      -> http://localhost:${PORT}`);
//         console.log(`API      -> http://${localIp}:${PORT}`);
//         console.log(`API Docs -> http://${localIp}:${PORT}/api-docs`);
//         console.log(`Health   -> http://${localIp}:${PORT}/health`);
//         console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
//         console.log(`📖 API Docs → http://localhost:${PORT}/api-docs`);
//         console.log(`🏥 Health   → http://localhost:${PORT}/health`);
//     });
// };
const start = async () => {
    await connectDB();

    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    app.listen(PORT, HOST, () => {
        console.log(`Host: ${HOST}`);

        console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);

        console.log(`API      -> ${appUrl}`);
        console.log(`API Docs -> ${appUrl}/api-docs`);
        console.log(`Health   -> ${appUrl}/health`);
    });
};

start();
