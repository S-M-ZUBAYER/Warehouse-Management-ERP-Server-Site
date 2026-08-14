'use strict';

const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../../utils/response');
const service = require('./autoOrderAccept.service');

const runNow = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 400, errors.array().map((error) => ({
                field: error.path,
                message: error.msg,
            })));
        }

        const result = await service.runAutoOrderAccept({
            user: req.user,
            source: 'api',
            filters: req.body || {},
        });

        return sendSuccess(res, 'Auto Order Accept run completed', result);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    runNow,
};
