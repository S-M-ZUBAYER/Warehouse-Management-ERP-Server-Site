'use strict';

const authService = require('./auth.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// ─── Admin Registration ───────────────────────────────────────────────────────
const register = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await authService.registerAdmin(req.body);
        return sendSuccess(res, 'Account created successfully', result, 201);
    } catch (err) {
        next(err);
    }
};

// ─── Login (Admin + Sub Account) ─────────────────────────────────────────────
const login = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await authService.login(req.body);
        return sendSuccess(res, 'Login successful', result);
    } catch (err) {
        next(err);
    }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        await authService.logout({
            userId: req.user.userId,
            companyId: req.user.companyId,
            accessToken: token,
        });
        return sendSuccess(res, 'Logged out successfully', null);
    } catch (err) {
        next(err);
    }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await authService.refreshAccessToken(req.body);
        return sendSuccess(res, 'Token refreshed', result);
    } catch (err) {
        next(err);
    }
};

// ─── Get My Profile ───────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
    try {
        const { User, Company, Role } = require('../../models');
        const user = await User.findOne({
            where: { id: req.user.userId, company_id: req.user.companyId },
            attributes: { exclude: ['password'] },
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name', 'slug', 'plan', 'status', 'logo_url', 'trial_ends_at'] },
                { model: Role, as: 'roleInfo', attributes: ['id', 'name', 'permissions'] },
            ],
        });
        if (!user) return sendError(res, 'User not found', 404);
        return sendSuccess(res, 'Profile fetched', user);
    } catch (err) {
        next(err);
    }
};

// ─── Sub Account CRUD ─────────────────────────────────────────────────────────
const getSubAccounts = async (req, res, next) => {
    try {
        const result = await authService.getSubAccounts(req.user, req.query);
        return sendSuccess(res, 'Sub accounts fetched successfully', result.data, 200, result.pagination);
    } catch (err) {
        next(err);
    }
};

const createSubAccount = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await authService.createSubAccount(req.user, req.body);
        return sendSuccess(res, 'Sub account created successfully', result, 201);
    } catch (err) {
        next(err);
    }
};

const getSubAccountById = async (req, res, next) => {
    try {
        const result = await authService.getSubAccountById(req.user, req.params.id);
        return sendSuccess(res, 'User fetched successfully', result);
    } catch (err) {
        next(err);
    }
};

const updateSubAccount = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }
        const result = await authService.updateSubAccount(req.user, req.params.id, req.body);
        return sendSuccess(res, 'User updated successfully', result);
    } catch (err) {
        next(err);
    }
};

const deleteSubAccount = async (req, res, next) => {
    try {
        await authService.deleteSubAccount(req.user, req.params.id);
        return sendSuccess(res, 'User deleted successfully', null);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    getMe,
    getSubAccounts,
    createSubAccount,
    getSubAccountById,
    updateSubAccount,
    deleteSubAccount,
};