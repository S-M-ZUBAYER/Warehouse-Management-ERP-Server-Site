'use strict';

const service = require('./outbound.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    sendError(res, 'Validation failed', 400, errors.array().map((e) => ({ field: e.path, message: e.msg })));
    return true;
};

const getDropdowns = async (req, res, next) => {
    try {
        const result = await service.getOutboundDropdowns(req.user);
        return sendSuccess(res, 'Dropdowns fetched', result);
    } catch (err) { next(err); }
};

const getSkuPicker = async (req, res, next) => {
    try {
        const result = await service.getSkusForOutboundPicker(req.user, req.query);
        return sendSuccess(res, 'SKUs fetched', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

const getOutboundOrders = async (req, res, next) => {
    try {
        const result = await service.getOutboundOrders(req.user, req.query);
        return sendSuccess(res, 'Outbound orders fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

const getOutboundOrderById = async (req, res, next) => {
    try {
        const result = await service.getOutboundOrderById(req.user, req.params.id);
        return sendSuccess(res, 'Outbound order fetched successfully', result);
    } catch (err) { next(err); }
};

const createOutboundOrder = async (req, res, next) => {
    try {
        if (handleValidation(req, res)) return;
        const result = await service.createOutboundOrder(req.user, req.body);
        return sendSuccess(res, 'Outbound draft created successfully', result, 201);
    } catch (err) { next(err); }
};

const updateDraftOutbound = async (req, res, next) => {
    try {
        if (handleValidation(req, res)) return;
        const result = await service.updateDraftOutbound(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Outbound draft updated successfully', result);
    } catch (err) { next(err); }
};

const deleteDraftOutbound = async (req, res, next) => {
    try {
        const result = await service.deleteDraftOutbound(req.user, req.params.id);
        return sendSuccess(res, 'Outbound draft deleted successfully', result);
    } catch (err) { next(err); }
};

const shipOutboundOrder = async (req, res, next) => {
    try {
        if (handleValidation(req, res)) return;
        const result = await service.shipOutboundOrder(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Outbound order shipped - status updated to on_the_way', result);
    } catch (err) { next(err); }
};

const receiveOutboundOrder = async (req, res, next) => {
    try {
        if (handleValidation(req, res)) return;
        const result = await service.receiveOutboundOrder(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Outbound order received successfully', result);
    } catch (err) { next(err); }
};

module.exports = {
    getDropdowns,
    getSkuPicker,
    getOutboundOrders,
    getOutboundOrderById,
    createOutboundOrder,
    updateDraftOutbound,
    deleteDraftOutbound,
    shipOutboundOrder,
    receiveOutboundOrder,
};