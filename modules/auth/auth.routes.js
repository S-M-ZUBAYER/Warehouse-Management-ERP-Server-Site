'use strict';

const express = require('express');
const router = express.Router();

const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth');
const { authLimiter } = require('../../config/rateLimiter');
const {
    registerAdminValidator,
    loginValidator,
    refreshTokenValidator,
    createSubAccountValidator,
    updateSubAccountValidator,
} = require('./auth.validator');

// ─── Public Routes (no auth required) ────────────────────────────────────────

// POST /api/v1/auth/register  — create company + admin
router.post('/register', authLimiter, registerAdminValidator, authController.register);

// POST /api/v1/auth/login  — admin or sub account login
router.post('/login', authLimiter, loginValidator, authController.login);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', refreshTokenValidator, authController.refreshToken);

// ─── Protected Routes (JWT required) ─────────────────────────────────────────

// GET  /api/v1/auth/me
router.get('/me', authenticate, authController.getMe);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, authController.logout);

module.exports = router;