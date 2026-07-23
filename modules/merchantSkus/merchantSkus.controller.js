'use strict';

const service = require('./merchantSkus.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/merchant-skus/dropdowns
// Returns warehouses + countries for the filter dropdowns
const getDropdowns = async (req, res, next) => {
    try {
        const [warehouses, countries] = await Promise.all([
            service.getWarehouseDropdown(req.user),
            service.getCountryDropdown(req.user),
        ]);
        return sendSuccess(res, 'Dropdowns fetched', { warehouses, countries });
    } catch (err) { next(err); }
};

// GET /api/v1/merchant-skus
const getMerchantSkus = async (req, res, next) => {
    try {
        const result = await service.getMerchantSkus(req.user, req.query);
        return sendSuccess(res, 'Products fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/merchant-skus/:id
const getMerchantSkuById = async (req, res, next) => {
    try {
        const result = await service.getMerchantSkuById(req.user, req.params.id);
        return sendSuccess(res, 'Product fetched successfully', result);
    } catch (err) { next(err); }
};

// POST /api/v1/merchant-skus
const createMerchantSku = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.createMerchantSku(req.user, req.body);
        return sendSuccess(res, 'Product created successfully', result, 201);
    } catch (err) { next(err); }
};

// PUT /api/v1/merchant-skus/:id
const updateMerchantSku = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.updateMerchantSku(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Product updated successfully', result);
    } catch (err) { next(err); }
};

// DELETE /api/v1/merchant-skus/:id
const deleteMerchantSku = async (req, res, next) => {
    try {
        await service.deleteMerchantSku(req.user, req.params.id);
        return sendSuccess(res, 'Product deleted successfully', null);
    } catch (err) { next(err); }
};

// DELETE /api/v1/merchant-skus/bulk (bulk action)
const bulkDeleteMerchantSkus = async (req, res, next) => {
    try {
        const { skuIds } = req.body;
        if (!skuIds || !Array.isArray(skuIds)) {
            return sendError(res, 'skuIds array is required', 400);
        }
        const result = await service.bulkDeleteMerchantSkus(req.user, skuIds);
        return sendSuccess(res, `${result.deleted} product(s) deleted successfully`, result);
    } catch (err) { next(err); }
};

module.exports = {
    getDropdowns,
    getMerchantSkus,
    getMerchantSkuById,
    createMerchantSku,
    updateMerchantSku,
    deleteMerchantSku,
    bulkDeleteMerchantSkus,
};