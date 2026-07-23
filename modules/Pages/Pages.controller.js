'use strict';

const pagesService = require('./Pages.service');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');

// GET /api/v1/pages
const getPages = async (req, res, next) => {
    try {
        const result = await pagesService.getPages();
        return sendSuccess(res, 'Pages fetched successfully', result);
    } catch (err) {
        next(err);
    }
};

// POST /api/v1/pages/seed  — owner only
const seedPages = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }

        const result = await pagesService.seedPages(req.body.pages);
        return sendSuccess(res, 'Pages seeded successfully', result, 201);
    } catch (err) {
        next(err);
    }
};

// PUT /api/v1/pages/:id  — owner only
const updatePage = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map(e => ({
                field: e.path, message: e.msg,
            })));
        }

        const result = await pagesService.updatePage(req.params.id, req.body);
        return sendSuccess(res, 'Page updated successfully', result);
    } catch (err) {
        next(err);
    }
};

// DELETE /api/v1/pages/:id  — owner only
const deletePage = async (req, res, next) => {
    try {
        await pagesService.deletePage(req.params.id);
        return sendSuccess(res, 'Page deleted successfully', null);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getPages,
    seedPages,
    updatePage,
    deletePage,
};