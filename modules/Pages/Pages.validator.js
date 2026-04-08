'use strict';
const { body } = require('express-validator');

// Recursive validator helper — validates one page node shape
const pageNodeShape = (prefix = '') => [
    body(`${prefix}key`)
        .trim()
        .notEmpty().withMessage('Page key is required')
        .isLength({ min: 1, max: 100 }).withMessage('Key must be 1–100 characters')
        .matches(/^[a-z0-9_]+$/).withMessage('Key must be lowercase letters, numbers, or underscores only'),

    body(`${prefix}label`)
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 150 }).withMessage('Label max 150 characters'),

    body(`${prefix}hasSub`)
        .optional()
        .isBoolean().withMessage('hasSub must be a boolean'),
];

// ── Seed validator ─────────────────────────────────────────────────────────────
const seedPagesValidator = [
    body('pages')
        .isArray({ min: 1 }).withMessage('pages must be a non-empty array'),

    body('pages.*.key')
        .trim()
        .notEmpty().withMessage('Each page must have a key')
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-z0-9_]+$/).withMessage('Key must be lowercase, numbers, or underscores'),

    body('pages.*.label')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 150 }),

    body('pages.*.hasSub')
        .optional()
        .isBoolean().withMessage('hasSub must be a boolean'),

    // Sub-level 1
    body('pages.*.sub')
        .optional()
        .isArray().withMessage('sub must be an array'),

    body('pages.*.sub.*.key')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-z0-9_]+$/).withMessage('Sub key must be lowercase, numbers, or underscores'),

    body('pages.*.sub.*.label')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 150 }),

    body('pages.*.sub.*.hasSub')
        .optional()
        .isBoolean(),

    // Sub-level 2 (sub-sub)
    body('pages.*.sub.*.sub')
        .optional()
        .isArray().withMessage('sub.sub must be an array'),

    body('pages.*.sub.*.sub.*.key')
        .optional()
        .trim()
        .notEmpty()
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-z0-9_]+$/).withMessage('Sub-sub key must be lowercase, numbers, or underscores'),

    body('pages.*.sub.*.sub.*.label')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 150 }),
];

// ── Update single page validator ───────────────────────────────────────────────
const updatePageValidator = [
    body('key')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-z0-9_]+$/).withMessage('Key must be lowercase, numbers, or underscores'),

    body('label')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 150 }),

    body('hasSub')
        .optional()
        .isBoolean().withMessage('hasSub must be a boolean'),

    body('order')
        .optional()
        .isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),

    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = {
    seedPagesValidator,
    updatePageValidator,
};