'use strict';

const { validationResult } = require('express-validator');
const service = require('./orderActivityLogs.service');
const { sendSuccess, sendError } = require('../../utils/response');

const validationErrorResponse = (res, errors) => sendError(
    res,
    'Validation failed',
    400,
    errors.array().map((error) => ({ field: error.path, message: error.msg }))
);

const listActivityLogs = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return validationErrorResponse(res, errors);

        const logs = await service.listActivityLogs(req.user, {
            ...req.query,
            platform: req.params.platform || req.query.platform,
            platformOrderId: req.params.orderId || req.query.platformOrderId || req.query.orderId,
        });
        return sendSuccess(res, 'Order activity logs loaded', logs);
    } catch (err) {
        next(err);
    }
};

const createActivityLog = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return validationErrorResponse(res, errors);

        const log = await service.createActivityLog(req.body, req.user);
        return sendSuccess(res, log.duplicate ? 'Order activity log already exists' : 'Order activity log saved', log, log.duplicate ? 200 : 201);
    } catch (err) {
        next(err);
    }
};

const createManyActivityLogs = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return validationErrorResponse(res, errors);

        const logs = await service.createManyActivityLogs(req.body.logs || [], req.user);
        return sendSuccess(res, 'Order activity logs saved', { count: logs.length, logs }, 201);
    } catch (err) {
        next(err);
    }
};

const createWebhookActivityLog = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return validationErrorResponse(res, errors);

        const payload = {
            ...req.body,
            actorType: req.body.actorType || 'WEBHOOK',
        };
        const log = await service.createActivityLog(payload, {
            actorType: 'WEBHOOK',
        });
        return sendSuccess(res, log.duplicate ? 'Order activity log already exists' : 'Order activity log saved', log, log.duplicate ? 200 : 201);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    listActivityLogs,
    createActivityLog,
    createManyActivityLogs,
    createWebhookActivityLog,
};
