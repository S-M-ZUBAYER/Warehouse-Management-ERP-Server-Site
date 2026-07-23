'use strict';

const rolesService = require('./roles.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/roles
const getRoles = async (req, res, next) => {
    try {
        const result = await rolesService.getRoles(req.user, req.query);
        return sendSuccess(res, 'Roles fetched successfully', result.data, 200, result.pagination);
    } catch (err) {
        next(err);
    }
};

// GET /api/v1/roles/permissions/template
const getPermissionTemplate = async (req, res, next) => {
    try {
        const result = rolesService.getPermissionTemplate();
        return sendSuccess(res, 'Permission template fetched', result);
    } catch (err) {
        next(err);
    }
};

// GET /api/v1/roles/:id
const getRoleById = async (req, res, next) => {
    try {
        const result = await rolesService.getRoleById(req.user, req.params.id);
        return sendSuccess(res, 'Role fetched successfully', result);
    } catch (err) {
        next(err);
    }
};

// POST /api/v1/roles
const createRole = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await rolesService.createRole(req.user, req.body);
        return sendSuccess(res, 'Role created successfully', result, 201);
    } catch (err) {
        next(err);
    }
};

// PUT /api/v1/roles/:id
const updateRole = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await rolesService.updateRole(req.user, req.params.id, req.body);
        return sendSuccess(res, 'Role updated successfully', result);
    } catch (err) {
        next(err);
    }
};

// DELETE /api/v1/roles/:id
const deleteRole = async (req, res, next) => {
    try {
        await rolesService.deleteRole(req.user, req.params.id);
        return sendSuccess(res, 'Role deleted successfully', null);
    } catch (err) {
        next(err);
    }
};

// PATCH /api/v1/roles/:id/permissions
const updatePermissions = async (req, res, next) => {
    try {
        if (!req.body.permissions || typeof req.body.permissions !== 'object') {
            return sendError(res, 'permissions object is required', 400);
        }
        const result = await rolesService.updatePermissions(req.user, req.params.id, req.body.permissions);
        return sendSuccess(res, 'Permissions updated successfully', result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getRoles,
    getPermissionTemplate,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    updatePermissions,
};