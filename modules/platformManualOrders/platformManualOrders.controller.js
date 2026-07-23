'use strict';

const { validationResult } = require('express-validator');
const service = require('./platformManualOrders.service');

const validationErrors = (errors) => errors.array().map((error) => ({ field: error.path, message: error.msg }));

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors(errors) });
        return false;
    }
    return true;
};

const listOrders = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const result = await service.listPlatformManualOrders(req.user, req.query);
        return res.json(result);
    } catch (err) {
        next(err);
    }
};

const createOrder = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const result = await service.createPlatformManualOrder(req.user, req.body, req.file);
        return res.status(201).json(result.order);
    } catch (err) {
        if (req.file?.path) require('fs').promises.unlink(req.file.path).catch(() => {});
        next(err);
    }
};

const updateOrder = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const result = await service.updatePlatformManualOrder(req.user, req.params.id, req.body, req.file);
        return res.json(result.order);
    } catch (err) {
        if (req.file?.path) require('fs').promises.unlink(req.file.path).catch(() => {});
        next(err);
    }
};

const updateStatus = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const result = await service.updatePlatformManualOrderStatus(req.user, req.params.id, req.body);
        return res.json(result);
    } catch (err) {
        next(err);
    }
};

const deleteOrder = async (req, res, next) => {
    try {
        const result = await service.deletePlatformManualOrder(req.user, req.params.id);
        return res.json(result);
    } catch (err) {
        next(err);
    }
};

const listWarehouses = async (req, res, next) => {
    try {
        const result = await service.listCompanyWarehouses(req.user, req.query);
        return res.json(result);
    } catch (err) {
        next(err);
    }
};

const listWarehouseMerchantSkus = async (req, res, next) => {
    try {
        const result = await service.listWarehouseMerchantSkus(req.user, req.params.warehouseId, req.query);
        return res.json(result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    listOrders,
    createOrder,
    updateOrder,
    updateStatus,
    deleteOrder,
    listWarehouses,
    listWarehouseMerchantSkus,
};
