'use strict';

const express = require('express');
const router = express.Router();

const pagesController = require('./Pages.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { seedPagesValidator, updatePageValidator } = require('./Pages.validator');

// GET /api/v1/pages — any authenticated user
router.get('/', authenticate, pagesController.getPages);

// POST /api/v1/pages/seed — owner only (bulk upsert full structure)
router.post('/seed', authenticate, requireRole('owner'), seedPagesValidator, pagesController.seedPages);

// PUT /api/v1/pages/:id — owner only (update single page)
router.put('/:id', authenticate, requireRole('owner'), updatePageValidator, pagesController.updatePage);

// DELETE /api/v1/pages/:id — owner only
router.delete('/:id', authenticate, requireRole('owner'), pagesController.deletePage);

module.exports = router;