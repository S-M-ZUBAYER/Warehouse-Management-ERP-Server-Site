'use strict';

const service = require('./inbound.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/inbound/dropdowns
const getDropdowns = async (req, res, next) => {
    try {
        const result = await service.getInboundDropdowns(req.user);
        return sendSuccess(res, 'Dropdowns fetched', result);
    } catch (err) { next(err); }
};

// GET /api/v1/inbound/picker  — SKU picker for adding lines
const getSkuPicker = async (req, res, next) => {
    try {
        const result = await service.getSkusForInboundPicker(req.user, req.query);
        return sendSuccess(res, 'SKUs fetched', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/inbound
const getInboundOrders = async (req, res, next) => {
    try {
        const result = await service.getInboundOrders(req.user, req.query);
        return sendSuccess(res, 'Inbound orders fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// GET /api/v1/inbound/:id
const getInboundOrderById = async (req, res, next) => {
    try {
        const result = await service.getInboundOrderById(req.user, req.params.id);
        return sendSuccess(res, 'Inbound order fetched successfully', result);
    } catch (err) { next(err); }
};

// POST /api/v1/inbound  — create draft
const createInboundOrder = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.createInboundOrder(req.user, req.body);
        return sendSuccess(res, 'Inbound draft created successfully', result, 201);
    } catch (err) { next(err); }
};

// PUT /api/v1/inbound/:id  — update draft fields/lines
const updateDraftInbound = async (req, res, next) => {
    try {
        const result = await service.updateDraftInbound(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Inbound draft updated successfully', result);
    } catch (err) { next(err); }
};

// PUT /api/v1/inbound/:id/ship  — draft → on_the_way
const shipInboundOrder = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.shipInboundOrder(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Inbound order shipped — status updated to on_the_way', result);
    } catch (err) { next(err); }
};

// PUT /api/v1/inbound/:id/receive  — on_the_way → completed
const receiveInboundOrder = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.receiveInboundOrder(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Inbound order received — stock updated successfully', result);
    } catch (err) { next(err); }
};

// PUT /api/v1/inbound/:id/cancel
const cancelInboundOrder = async (req, res, next) => {
    try {
        const result = await service.cancelInboundOrder(req.user, req.params.id);
        return sendSuccess(res, 'Inbound order cancelled successfully', result);
    } catch (err) { next(err); }
};

module.exports = {
    getDropdowns,
    getSkuPicker,
    getInboundOrders,
    getInboundOrderById,
    createInboundOrder,
    updateDraftInbound,
    shipInboundOrder,
    receiveInboundOrder,
    cancelInboundOrder,
};