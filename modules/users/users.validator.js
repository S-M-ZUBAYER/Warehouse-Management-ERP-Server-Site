// 'use strict';
// const { body, param, query } = require('express-validator');

// // ── Upsert subaccount ───────────────────────────────────────────────────────
// const upsertUserValidator = [
//     body('email')
//         .trim()
//         .notEmpty().withMessage('Email is required')
//         .isEmail().withMessage('Invalid email address')
//         .normalizeEmail(),

//     body('role_id')
//         .notEmpty().withMessage('role_id is required')
//         .isInt({ min: 1 }).withMessage('role_id must be a valid integer'),

//     // Always required — the calling company owner sets the password
//     body('password')
//         .notEmpty().withMessage('Password is required')
//         .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

//     body('first_name')
//         .optional()
//         .trim()
//         .isLength({ max: 80 }),

//     body('last_name')
//         .optional()
//         .trim()
//         .isLength({ max: 80 }),

//     body('phone')
//         .optional()
//         .isMobilePhone().withMessage('Invalid phone number'),
// ];

// // ── List users query params ─────────────────────────────────────────────────
// const listUsersValidator = [
//     query('page').optional().isInt({ min: 1 }),
//     query('limit').optional().isInt({ min: 1, max: 100 }),
//     query('search').optional().isString().trim().isLength({ max: 100 }),
//     query('role_id').optional().isInt({ min: 1 }),
//     query('is_active').optional().isBoolean(),
// ];

// // ── ID param ────────────────────────────────────────────────────────────────
// const userIdValidator = [
//     param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
// ];

// module.exports = { upsertUserValidator, listUsersValidator, userIdValidator };