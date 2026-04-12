const swaggerJsdoc = require('swagger-jsdoc');
const base = require('./base');

// ── Import all module files ───────────────────────────────────────────
const authModule = require('./paths/auth.paths');
const usersModule = require('./paths/users.paths');
const pagesModule = require('./paths/Pages.paths');
const rolesModule = require('./paths/roles.paths');
const warehousesModule = require('./paths/warehouses.paths');
const merchantSkuModule = require('./paths/merchant-skus.paths');
const combineSkuModule = require('./paths/combine-skus.paths');
const inboundModule = require('./paths/inbound.paths');
const stockModule = require('./paths/stock.paths');
const platformStoreModule = require('./paths/platform_stores.paths');
const platformSkuMappingModule = require('./paths/platform_sku_mappings.paths');
// ✅ Adding a new module = one import line + one entry in the array below

const modules = [
    authModule,
    usersModule,
    pagesModule,
    rolesModule,
    warehousesModule,
    merchantSkuModule,
    combineSkuModule,
    inboundModule,
    stockModule,
    platformStoreModule,
    platformSkuMappingModule
];

// ── Auto-merge all modules into base ─────────────────────────────────
const mergedSchemas = modules.reduce((acc, mod) => {
    return { ...acc, ...(mod.schemas || {}) };
}, base.components.schemas);

const mergedPaths = modules.reduce((acc, mod) => {
    return { ...acc, ...(mod.paths || {}) };
}, {});

const swaggerSpec = swaggerJsdoc({
    definition: {
        ...base,
        components: {
            ...base.components,
            schemas: mergedSchemas,   // ✅ all schemas merged
        },
        paths: mergedPaths,           // ✅ all paths merged
    },
    apis: [],
});

module.exports = swaggerSpec;