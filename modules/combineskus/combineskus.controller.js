'use strict';

const service = require('./combineskus.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/combine-skus/picker  — merchant SKU picker for Add Combine SKU screen
const getMerchantSkusForPicker = async (req, res, next) => {
    try {
        const result = await service.getMerchantSkusForPicker(req.user, req.query);
        return sendSuccess(res, 'Merchant SKUs fetched', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/combine-skus
const getCombineSkus = async (req, res, next) => {
    try {
        const result = await service.getCombineSkus(req.user, req.query);
        return sendSuccess(res, 'Combine SKUs fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/combine-skus/:id
const getCombineSkuById = async (req, res, next) => {
    try {
        const result = await service.getCombineSkuById(req.user, req.params.id);
        return sendSuccess(res, 'Combine SKU fetched successfully', result);
    } catch (err) { next(err); }
};

// POST /api/v1/combine-skus
const createCombineSku = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.createCombineSku(req.user, req.body);
        return sendSuccess(res, 'Combine SKU created successfully', result, 201);
    } catch (err) { next(err); }
};

// PUT /api/v1/combine-skus/:id
const updateCombineSku = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.updateCombineSku(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Combine SKU updated successfully', result);
    } catch (err) { next(err); }
};

// DELETE /api/v1/combine-skus/:id
const deleteCombineSku = async (req, res, next) => {
    try {
        await service.deleteCombineSku(req.user, req.params.id);
        return sendSuccess(res, 'Combine SKU deleted successfully', null);
    } catch (err) { next(err); }
};

module.exports = {
    getMerchantSkusForPicker,
    getCombineSkus,
    getCombineSkuById,
    createCombineSku,
    updateCombineSku,
    deleteCombineSku,
};