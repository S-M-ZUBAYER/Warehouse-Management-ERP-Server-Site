'use strict';
// ── skuMapping.controller.js ──────────────────────────────────────────────────

const service = require('./skuMapping.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

const getDropdowns         = async (req, res, next) => { try { return sendSuccess(res, 'Dropdowns', await service.getDropdowns(req.user)); } catch (e) { next(e); } };
const getMerchantList      = async (req, res, next) => { try { const r = await service.getMerchantSkuList(req.user, req.query); return sendSuccess(res, 'Merchant SKUs', r.data, 200, r.pagination); } catch (e) { next(e); } };
const getMerchantCounts    = async (req, res, next) => { try { return sendSuccess(res, 'Counts', await service.getMerchantSkuCounts(req.user)); } catch (e) { next(e); } };
const getProductPicker     = async (req, res, next) => { try { const r = await service.getPlatformProductPicker(req.user, req.query); return sendSuccess(res, 'Picker', r.data, 200, r.pagination); } catch (e) { next(e); } };

const createMapping = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        const result = await service.createMappingFromModal(req.user, req.body);
        return sendSuccess(res, result.message, result, 201);
    } catch (e) { next(e); }
};

const unlinkMapping = async (req, res, next) => { try { return sendSuccess(res, 'Unlinked', await service.unlinkMerchantMapping(req.user, parseInt(req.params.id, 10))); } catch (e) { next(e); } };
const syncMapped    = async (req, res, next) => { try { const r = await service.syncMappedSkus(req.user, req.body); return sendSuccess(res, r.message, r); } catch (e) { next(e); } };

const createStoreMapping = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array());
        const result = await service.createStoreMappings(req.user, req.body);
        return sendSuccess(res, result.message, result, 201);
    } catch (e) { next(e); }
};

// ── skuMapping.routes.js ──────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../../middlewares/auth');
const { body } = require('express-validator');

router.use(authenticate);

// GET /api/v1/sku-mapping/dropdowns
router.get('/dropdowns', getDropdowns);

// GET /api/v1/sku-mapping/by-merchant             — ByMerchantSKUMappingPage list
router.get('/by-merchant', getMerchantList);

// GET /api/v1/sku-mapping/by-merchant/counts      — tab badge counts
router.get('/by-merchant/counts', getMerchantCounts);

// GET /api/v1/sku-mapping/product-picker          — Add Mapping modal left panel
// ?platformStoreId=1&mappingStatus=not_mapped&skuType=product_name&search=&page=1&limit=50
router.get('/product-picker', getProductPicker);

// POST /api/v1/sku-mapping/mapping                — Confirm in Add Mapping modal
router.post(
    '/mapping',
    requireRole('owner', 'admin', 'manager'),
    [
        body('merchantSkuId').notEmpty().isInt({ min: 1 }).toInt(),
        body('platformProductIds').isArray({ min: 1 }).withMessage('Select at least one product'),
        body('platformProductIds.*').isInt({ min: 1 }).toInt(),
        body('platformStoreId').optional().isInt({ min: 1 }).toInt(),
    ],
    createMapping
);

// POST /api/v1/sku-mapping/store-mapping         — Map parent SKU to selected stores
router.post(
    '/store-mapping',
    requireRole('owner', 'admin', 'manager'),
    [
        body('merchantSkuId').notEmpty().isInt({ min: 1 }).toInt(),
        body('platformStoreIds').isArray({ min: 1 }).withMessage('Select at least one store'),
        body('platformStoreIds.*').isInt({ min: 1 }).toInt(),
        body('platformProductIds').optional().isArray(),
        body('platformProductIds.*').optional().isInt({ min: 1 }).toInt(),
        body('childMerchantSkuIds').optional().isArray(),
        body('childMerchantSkuIds.*').optional().isInt({ min: 1 }).toInt(),
    ],
    createStoreMapping
);

// DELETE /api/v1/sku-mapping/mapping/:id          — Unlink (unmap) action
router.delete('/mapping/:id', requireRole('owner', 'admin', 'manager'), unlinkMapping);

// POST /api/v1/sku-mapping/sync-mapped            — Sync Mapped button
router.post(
    '/sync-mapped',
    requireRole('owner', 'admin', 'manager'),
    [body('merchantSkuId').notEmpty().isInt({ min: 1 }).toInt()],
    syncMapped
);

module.exports = router;