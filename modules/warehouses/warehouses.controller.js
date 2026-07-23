'use strict';

const warehouseService = require('./warehouses.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/warehouses
const getWarehouses = async (req, res, next) => {
    try {
        const result = await warehouseService.getWarehouses(req.user, req.query);
        return sendSuccess(res, 'Warehouses fetched successfully', result.data, 200, result.pagination);
    } catch (err) {
        next(err);
    }
};

// GET /api/v1/warehouses/:id
const getWarehouseById = async (req, res, next) => {
    try {
        const result = await warehouseService.getWarehouseById(req.user, req.params.id);
        return sendSuccess(res, 'Warehouse fetched successfully', result);
    } catch (err) {
        next(err);
    }
};

// POST /api/v1/warehouses
const createWarehouse = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await warehouseService.createWarehouse(req.user, req.body);
        return sendSuccess(res, 'Warehouse created successfully', result, 201);
    } catch (err) {
        next(err);
    }
};

// PUT /api/v1/warehouses/:id
const updateWarehouse = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await warehouseService.updateWarehouse(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Warehouse updated successfully', result);
    } catch (err) {
        next(err);
    }
};

// DELETE /api/v1/warehouses/:id
const deleteWarehouse = async (req, res, next) => {
    try {
        await warehouseService.deleteWarehouse(req.user, req.params.id);
        return sendSuccess(res, 'Warehouse deleted successfully', null);
    } catch (err) {
        next(err);
    }
};

// PATCH /api/v1/warehouses/:id/set-default
const setDefaultWarehouse = async (req, res, next) => {
    try {
        const result = await warehouseService.setDefaultWarehouse(req.user, req.params.id);
        return sendSuccess(res, 'Default warehouse updated successfully', result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getWarehouses,
    getWarehouseById,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    setDefaultWarehouse,
};