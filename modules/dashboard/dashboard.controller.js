'use strict';

const service = require('./dashboard.service');
const { sendSuccess } = require('../../utils/response');

const getSummary = async (req, res, next) => {
    try {
        const result = await service.getDashboardSummary(req.user);
        return sendSuccess(res, 'Dashboard summary fetched', result);
    } catch (err) {
        next(err);
    }
};

const getInventoryStatus = async (req, res, next) => {
    try {
        const result = await service.getInventoryStatus(req.user, req.query);
        return sendSuccess(res, 'Dashboard inventory status fetched', result);
    } catch (err) {
        next(err);
    }
};

const getSalesTrends = async (req, res, next) => {
    try {
        const result = await service.getSalesTrends(req.user, req.query);
        return sendSuccess(res, 'Dashboard sales trends fetched', result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getSummary,
    getInventoryStatus,
    getSalesTrends,
};
