// // ─── platformStores.controller.js ────────────────────────────────────────────
// 'use strict';

// const service = require('./platformStores.service');
// const { validationResult } = require('express-validator');
// const { sendSuccess, sendError } = require('../../utils/response');

// const getPlatformStores = async (req, res, next) => {
//     try {
//         const result = await service.getPlatformStores(req.user, req.query);
//         return sendSuccess(res, 'Platform stores fetched successfully', result.data, 200, result.pagination);
//     } catch (err) { next(err); }
// };

// const getPlatformStoreById = async (req, res, next) => {
//     try {
//         const result = await service.getPlatformStoreById(req.user, req.params.id);
//         return sendSuccess(res, 'Platform store fetched successfully', result);
//     } catch (err) { next(err); }
// };

// const createPlatformStore = async (req, res, next) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
//         const result = await service.createPlatformStore(req.user, req.body);
//         return sendSuccess(res, 'Platform store connected successfully', result, 201);
//     } catch (err) { next(err); }
// };

// const updatePlatformStore = async (req, res, next) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
//         const result = await service.updatePlatformStore(req.user, req.params.id, req.body);
//         return sendSuccess(res, 'Platform store updated successfully', result);
//     } catch (err) { next(err); }
// };

// const updateStoreTokens = async (req, res, next) => {
//     try {
//         const result = await service.updateStoreTokens(req.user, req.params.id, req.body);
//         return sendSuccess(res, 'Store tokens updated successfully', result);
//     } catch (err) { next(err); }
// };

// const deletePlatformStore = async (req, res, next) => {
//     try {
//         await service.deletePlatformStore(req.user, req.params.id);
//         return sendSuccess(res, 'Platform store disconnected successfully', null);
//     } catch (err) { next(err); }
// };

// module.exports = { getPlatformStores, getPlatformStoreById, createPlatformStore, updatePlatformStore, updateStoreTokens, deletePlatformStore };


// ─── platformStores.controller.js ────────────────────────────────────────────
'use strict';

const service = require('./platformStores.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

const getPlatformStores = async (req, res, next) => {
    try {
        const result = await service.getPlatformStores(req.user, req.query);
        return sendSuccess(res, 'Platform stores fetched successfully', result.data, 200, result.pagination);
    } catch (err) { next(err); }
};

const getPlatformStoreById = async (req, res, next) => {
    try {
        const result = await service.getPlatformStoreById(req.user, req.params.id);
        return sendSuccess(res, 'Platform store fetched successfully', result);
    } catch (err) { next(err); }
};

const createPlatformStore = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        const result = await service.createPlatformStore(req.user, req.body);
        return sendSuccess(res, 'Platform store connected successfully', result, 201);
    } catch (err) { next(err); }
};

const updatePlatformStore = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return sendError(res, 'Validation failed', 400, errors.array().map(e => ({ field: e.path, message: e.msg })));
        const result = await service.updatePlatformStore(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Platform store updated successfully', result);
    } catch (err) { next(err); }
};

const updateStoreTokens = async (req, res, next) => {
    try {
        const result = await service.updateStoreTokens(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Store tokens updated successfully', result);
    } catch (err) { next(err); }
};

const deletePlatformStore = async (req, res, next) => {
    try {
        await service.deletePlatformStore(req.user, req.params.id);
        return sendSuccess(res, 'Platform store disconnected successfully', null);
    } catch (err) { next(err); }
};

module.exports = { getPlatformStores, getPlatformStoreById, createPlatformStore, updatePlatformStore, updateStoreTokens, deletePlatformStore };