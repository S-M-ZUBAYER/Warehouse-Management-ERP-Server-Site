// ─── platformSkuMappings.controller.js ───────────────────────────────────────
'use strict';

const service = require('./platformSkuMappings.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

const getPlatformSkuMappings = async (req, res, next) => {
    try {
        const result = await service.getPlatformSkuMappings(req.user, req.query);
        return sendSuccess(res, 'Mappings fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

const getPlatformSkuMappingById = async (req, res, next) => {
    try {
        const result = await service.getPlatformSkuMappingById(req.user, req.params.id);
        return sendSuccess(res, 'Mapping fetched successfully', result);
    } catch (err) { next(err); }
};

const createPlatformSkuMapping = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        const result = await service.createPlatformSkuMapping(req.user, req.body);
        return sendSuccess(res, 'SKU mapped to platform store successfully', result, 201);
    } catch (err) { next(err); }
};

const updatePlatformSkuMapping = async (req, res, next) => {
    try {
        const result = await service.updatePlatformSkuMapping(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Mapping updated successfully', result);
    } catch (err) { next(err); }
};

// PUT /:id/sync-callback  — Java calls this after pushing product to platform
const syncCallback = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        const result = await service.syncCallback(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Sync callback recorded successfully', result);
    } catch (err) { next(err); }
};

const deletePlatformSkuMapping = async (req, res, next) => {
    try {
        await service.deletePlatformSkuMapping(req.user, req.params.id);
        return sendSuccess(res, 'Mapping removed successfully', null);
    } catch (err) { next(err); }
};

// GET /pending-sync  — Java polls this for mappings that need a product push
const getPendingSyncMappings = async (req, res, next) => {
    try {
        const result = await service.getPendingSyncMappings(req.user, req.query);
        return sendSuccess(res, 'Pending sync mappings fetched', result);
    } catch (err) { next(err); }
};

module.exports = {
    getPlatformSkuMappings, getPlatformSkuMappingById, createPlatformSkuMapping,
    updatePlatformSkuMapping, syncCallback, deletePlatformSkuMapping, getPendingSyncMappings,
};