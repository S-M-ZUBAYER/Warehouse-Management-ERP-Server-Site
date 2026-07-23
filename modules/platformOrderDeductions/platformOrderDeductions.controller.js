'use strict';

const { validationResult } = require('express-validator');
const service = require('./platformOrderDeductions.service');
const { sendSuccess, sendError } = require('../../utils/response');

const handleDeductFromOrderNotification = (platform) => async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(
                res,
                'Validation failed',
                400,
                errors.array().map((e) => ({ field: e.path, message: e.msg }))
            );
        }

        const result = await service.deductFromOrderNotification(platform, req.body);
        return sendSuccess(
            res,
            result.alreadyDeducted ? 'Already packed (idempotent)' : (result.alreadyReserved ? 'Already reserved (idempotent)' : 'Order stock reserved successfully'),
            result
        );
    } catch (err) {
        next(err);
    }
};

const finalizePackedOrderNotification = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(
                res,
                'Validation failed',
                400,
                errors.array().map((e) => ({ field: e.path, message: e.msg }))
            );
        }

        const result = await service.finalizePackedOrderNotification(req.body);
        return sendSuccess(res, 'Packed stock finalized', result);
    } catch (err) {
        next(err);
    }
};

const savePlatformOrderItemSkuOverride = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(
                res,
                'Validation failed',
                400,
                errors.array().map((e) => ({ field: e.path, message: e.msg }))
            );
        }

        const result = await service.savePlatformOrderItemSkuOverride(req.body);
        return sendSuccess(res, 'Platform order item SKU override saved', result);
    } catch (err) {
        next(err);
    }
};

const deletePlatformOrderSkuOverrides = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(
                res,
                'Validation failed',
                400,
                errors.array().map((e) => ({ field: e.path, message: e.msg }))
            );
        }

        const result = await service.deletePlatformOrderSkuOverrides(req.body);
        return sendSuccess(res, 'Platform order SKU overrides deleted', result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    deductShopeeOrderNotification: handleDeductFromOrderNotification('shopee'),
    deductTikTokOrderNotification: handleDeductFromOrderNotification('tiktok'),
    finalizePackedOrderNotification,
    savePlatformOrderItemSkuOverride,
    deletePlatformOrderSkuOverrides,
};
