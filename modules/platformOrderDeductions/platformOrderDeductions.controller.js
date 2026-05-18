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
            result.alreadyDeducted ? 'Already deducted (idempotent)' : 'Order stock deducted successfully',
            result
        );
    } catch (err) {
        next(err);
    }
};

module.exports = {
    deductShopeeOrderNotification: handleDeductFromOrderNotification('shopee'),
    deductTikTokOrderNotification: handleDeductFromOrderNotification('tiktok'),
};
