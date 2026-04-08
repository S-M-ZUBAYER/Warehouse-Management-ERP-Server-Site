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
// ✅ Adding a new module = one import line + one entry in the array below

const modules = [
    authModule,
    usersModule,
    pagesModule,
    rolesModule,
    warehousesModule,
    merchantSkuModule,
    combineSkuModule,
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