'use strict';

const service = require('./inventory.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/inventory/dropdowns
// Returns warehouses list for the filter bar dropdown
// ─────────────────────────────────────────────────────────────────────────────
const getDropdowns = async (req, res, next) => {
    try {
        const result = await service.getInventoryDropdowns(req.user);
        return sendSuccess(res, 'Dropdowns fetched', result);
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/inventory/counts
// Returns { all, mapped, unmapped } for the tab badges
// Query params: warehouseId (optional)
// ─────────────────────────────────────────────────────────────────────────────
const getInventoryCounts = async (req, res, next) => {
    try {
        const result = await service.getInventoryCounts(req.user, req.query);
        return sendSuccess(res, 'Inventory counts fetched', result);
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/inventory
// Paginated inventory list with stock + mapping status
// Query params: warehouseId | search | skuType | mappingStatus | page | limit | sortBy | sortOrder
// ─────────────────────────────────────────────────────────────────────────────
const getInventoryList = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.getInventoryList(req.user, req.query);
        return sendSuccess(res, 'Inventory fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/inventory/stock-alert
// Set minimum stock alert threshold for selected inventory rows
// Body: { skuIds: [1, 2, 3], minStock: 10 }
// ─────────────────────────────────────────────────────────────────────────────
const setStockAlert = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.setStockAlert(req.user, req.body);
        return sendSuccess(res, result.message, result);
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/inventory/sync
// Mark selected mapped SKUs as out_of_sync so Java re-pushes to platforms
// Body: { skuIds: [] }  ← empty = sync ALL mapped SKUs
// ─────────────────────────────────────────────────────────────────────────────
const syncInventory = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        }
        const result = await service.syncInventory(req.user, req.body);
        return sendSuccess(res, result.message, result);
    } catch (err) { next(err); }
};

module.exports = {
    getDropdowns,
    getInventoryCounts,
    getInventoryList,
    setStockAlert,
    syncInventory,
};
