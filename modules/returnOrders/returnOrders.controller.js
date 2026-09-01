'use strict';

const { validationResult } = require('express-validator');
const service = require('./returnOrders.service');
const { sendSuccess, sendError } = require('../../utils/response');

const validationErrorResponse = (req, res) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    sendError(res, 'Validation failed', 400, errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
    })));
    return true;
};

const listReturnOrders = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const syncTriggers = await Promise.allSettled([
            service.startShopeeReturnSyncJob(req.user, { source: 'page-render', dueOnly: true }),
            service.startTikTokReturnSyncJob(req.user, { source: 'page-render', dueOnly: true }),
        ]);
        syncTriggers.forEach((result, index) => {
            if (result.status === 'rejected') {
                const platform = index === 0 ? 'Shopee' : 'TikTok';
                console.error(`[returnOrders] page-render ${platform} sync trigger failed:`, result.reason?.message || result.reason);
            }
        });
        const result = await service.listReturnOrders(req.user, req.query);
        return sendSuccess(res, 'Return orders fetched successfully', result.data, 200, result.pagination);
    } catch (err) {
        return next(err);
    }
};

const getReturnOrderById = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.getReturnOrderById(req.user, req.params.id);
        return sendSuccess(res, 'Return order fetched successfully', result);
    } catch (err) {
        return next(err);
    }
};

const syncTikTokReturnOrders = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.startTikTokReturnSyncJob(req.user, { ...req.body, source: 'manual' });
        return sendSuccess(res, result.alreadyRunning ? 'TikTok return sync is already running' : 'TikTok return sync started', result);
    } catch (err) {
        return next(err);
    }
};

const syncShopeeReturnOrders = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.startShopeeReturnSyncJob(req.user, { ...req.body, source: 'manual' });
        return sendSuccess(res, result.alreadyRunning ? 'Shopee return sync is already running' : 'Shopee return sync started', result);
    } catch (err) {
        return next(err);
    }
};

const getSyncStatus = async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
        return sendSuccess(res, 'Return sync status fetched successfully', service.getReturnSyncJobStatus(req.user));
    } catch (err) {
        return next(err);
    }
};

const createManualReturnOrder = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.createManualReturnOrder(req.user, req.body);
        return sendSuccess(res, 'Manual return order created successfully', result, 201);
    } catch (err) {
        return next(err);
    }
};

const lookupManualReturnOrder = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.lookupManualReturnOrder(req.user, req.body);
        return sendSuccess(res, 'Order details fetched successfully', result);
    } catch (err) {
        return next(err);
    }
};

const updateReturnStatus = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.updateReturnStatus(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Return status updated successfully', result);
    } catch (err) {
        return next(err);
    }
};

const updateManualReturnOrder = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.updateManualReturnOrder(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Manual return order updated successfully', result);
    } catch (err) {
        return next(err);
    }
};

const deleteReturnOrder = async (req, res, next) => {
    try {
        if (validationErrorResponse(req, res)) return null;
        const result = await service.deleteReturnOrder(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Return order deleted successfully', result);
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    listReturnOrders,
    getReturnOrderById,
    syncTikTokReturnOrders,
    syncShopeeReturnOrders,
    getSyncStatus,
    lookupManualReturnOrder,
    createManualReturnOrder,
    updateManualReturnOrder,
    updateReturnStatus,
    deleteReturnOrder,
};
