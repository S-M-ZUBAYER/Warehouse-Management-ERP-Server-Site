'use strict';

const service = require('./stock.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/stock/merchant/:merchantSkuId
const getStockByMerchantSku = async (req, res, next) => {
    try {
        const result = await service.getStockByMerchantSku(req.user, req.params.merchantSkuId);
        return sendSuccess(res, 'Stock fetched successfully', result);
    } catch (err) { next(err); }
};

// GET /api/v1/stock/combine/:combineSkuId
const getStockByCombineSku = async (req, res, next) => {
    try {
        const result = await service.getStockByCombineSku(req.user, req.params.combineSkuId);
        return sendSuccess(res, 'Combine SKU stock fetched successfully', result);
    } catch (err) { next(err); }
};

// POST /api/v1/stock/bulk  — Java uses this to fetch multiple SKU stocks at once
const getBulkStock = async (req, res, next) => {
    try {
        const { merchantSkuIds = [], combineSkuIds = [] } = req.body;
        if (!Array.isArray(merchantSkuIds) || !Array.isArray(combineSkuIds)) {
            return sendError(res, 'merchantSkuIds and combineSkuIds must be arrays', 400);
        }
        const result = await service.getBulkStock(req.user, { merchantSkuIds, combineSkuIds });
        return sendSuccess(res, 'Bulk stock fetched successfully', result);
    } catch (err) { next(err); }
};

// POST /api/v1/stock/adjust  — manual stock correction (admin only)
const manualAdjustStock = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.manualAdjustStock(req.user, req.body);
        return sendSuccess(res, 'Stock adjusted successfully', result);
    } catch (err) { next(err); }
};

// POST /api/v1/stock/deduct  — called by Java Spring Boot after sale webhook
const deductStock = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.deductStock(req.user, req.body);
        return sendSuccess(res, result.alreadyDeducted ? 'Already deducted (idempotent)' : 'Stock deducted successfully', result);
    } catch (err) { next(err); }
};

// GET /api/v1/stock/ledger  — audit log
const getStockLedger = async (req, res, next) => {
    try {
        const result = await service.getStockLedger(req.user, req.query);
        return sendSuccess(res, 'Stock ledger fetched', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

module.exports = {
    getStockByMerchantSku,
    getStockByCombineSku,
    getBulkStock,
    manualAdjustStock,
    deductStock,
    getStockLedger,
};