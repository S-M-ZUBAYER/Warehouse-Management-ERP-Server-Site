// 'use strict';

// const service = require('./platformProducts.service');
// const { validationResult } = require('express-validator');
// const { sendSuccess, sendError } = require('../../utils/response');

// const getList = async (req, res, next) => {
//     try {
//         const result = await service.getPlatformProducts(req.user, req.query);
//         return sendSuccess(res, 'Platform products fetched', result.data, 200, result.pagination);
//     } catch (err) { next(err); }
// };

// const getCounts = async (req, res, next) => {
//     try {
//         const result = await service.getPlatformProductCounts(req.user, req.query);
//         return sendSuccess(res, 'Counts fetched', result);
//     } catch (err) { next(err); }
// };

// const syncProducts = async (req, res, next) => {
//     try {
//         console.log("syncProducts");
        
//         const result = await service.syncAllStores(req.user, req.query);
//         return sendSuccess(res, result.message, result);
//     } catch (err) { next(err); }
// };

// const generateSku = async (req, res, next) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
//         const result = await service.generateMerchantSku(req.user, req.body);
//         return sendSuccess(res, result.message, result, 201);
//     } catch (err) { next(err); }
// };

// const autoMap = async (req, res, next) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
//         const result = await service.autoMapping(req.user, req.body);
//         return sendSuccess(res, result.message, result);
//     } catch (err) { next(err); }
// };

// const pushStock = async (req, res, next) => {
//     try {
//         const result = await service.updatePlatformStock(req.user, req.body);
//         return sendSuccess(res, 'Stock updated on platform', result);
//     } catch (err) { next(err); }
// };

// const unlink = async (req, res, next) => {
//     try {
//         const result = await service.unlinkMapping(req.user, parseInt(req.params.mappingId, 10));
//         return sendSuccess(res, 'Mapping removed', result);
//     } catch (err) { next(err); }
// };

// // ── NEW handler ───────────────────────────────────────────────────────────────
// // mapMerchantSku
// // Called from ByProductSKUMappingPage → "Add Mapping with Store" modal.
// // Receives a platform product ID and a merchant SKU ID, creates the
// // platform_sku_mapping row, and marks the platform product as mapped.
// // ─────────────────────────────────────────────────────────────────────────────
// const mapMerchantSku = async (req, res, next) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
//         const result = await service.mapMerchantSkuToProduct(req.user, req.body);
//         return sendSuccess(res, result.message, result, 201);
//     } catch (err) { next(err); }
// };
 
// module.exports = {
//     getList,
//     getCounts,
//     syncProducts,
//     generateSku,
//     autoMap,
//     pushStock,
//     unlink,
//     mapMerchantSku, // ← NEW
// };


'use strict';

const service = require('./platformProducts.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/platform-products — flat list (used by merchant page picker)
const getList = async (req, res, next) => {
    try {
        const result = await service.getPlatformProducts(req.user, req.query);
        return sendSuccess(res, 'Platform products fetched', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/platform-products/hierarchy — 3-level tree for ByProductSKUMappingPage
// Returns: parent rows, each with children[] (child SKUs), each child with platform_mappings[]
const getHierarchy = async (req, res, next) => {
    try {
        const result = await service.getProductHierarchy(req.user, req.query);
        return sendSuccess(res, 'Product hierarchy fetched', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/platform-products/counts
const getCounts = async (req, res, next) => {
    try {
        const result = await service.getPlatformProductCounts(req.user, req.query);
        return sendSuccess(res, 'Counts fetched', result);
    } catch (err) { next(err); }
};

// POST /api/v1/platform-products/sync
const syncProducts = async (req, res, next) => {
    try {
        const result = await service.syncAllStores(req.user, req.query);
        return sendSuccess(res, result.message, result);
    } catch (err) { next(err); }
};

// POST /api/v1/platform-products/generate-sku
const generateSku = async (req, res, next) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array());
        }

        const result = await service.generateMerchantSku(req.user, req.body);
        return sendSuccess(res, result.message, result, 201);
    } catch (err) {
        console.log(err.name);
        console.log(err.message);
        console.log(err.errors?.map(e => ({
            path: e.path,
            value: e.value,
            message: e.message,
        })));

        return next(err);
    }
};

// POST /api/v1/platform-products/auto-mapping
const autoMap = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        const result = await service.autoMapping(req.user, req.body);
        return sendSuccess(res, result.message, result);
    } catch (err) { next(err); }
};

// POST /api/v1/platform-products/stock
const pushStock = async (req, res, next) => {
    try {
        const result = await service.updatePlatformStock(req.user, req.body);
        return sendSuccess(res, 'Stock updated on platform', result);
    } catch (err) { next(err); }
};

// DELETE /api/v1/platform-products/mapping/:mappingId
const unlink = async (req, res, next) => {
    try {
        const result = await service.unlinkMapping(req.user, parseInt(req.params.mappingId, 10));
        return sendSuccess(res, 'Mapping removed', result);
    } catch (err) { next(err); }
};

// POST /api/v1/platform-products/map-merchant-sku
// "Add Mapping with Store" from ByProductSKUMappingPage
const mapMerchantSku = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        const result = await service.mapMerchantSkuToProduct(req.user, req.body);
        return sendSuccess(res, result.message, result, 201);
    } catch (err) { next(err); }
};

module.exports = {
    getList,
    getHierarchy,
    getCounts,
    syncProducts,
    generateSku,
    autoMap,
    pushStock,
    unlink,
    mapMerchantSku,
};