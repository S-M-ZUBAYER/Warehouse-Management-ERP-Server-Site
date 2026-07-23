'use strict';

const { validationResult } = require('express-validator');
const service = require('./pushSuccessfulOrders.service');

const validationErrors = (errors) => errors.array().map((error) => ({
    field: error.path,
    message: error.msg,
}));

const listPushSuccessfulOrders = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: false, message: 'Validation failed', errors: validationErrors(errors) });
        }

        const data = await service.listPushSuccessfulOrders(req.user, req.query);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const upsertPushSuccessfulOrders = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: false, message: 'Validation failed', errors: validationErrors(errors) });
        }

        const result = await service.upsertPushSuccessfulOrders(req.user, req.body);
        return res.status(201).json({ status: true, data: result });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    listPushSuccessfulOrders,
    upsertPushSuccessfulOrders,
};
