'use strict';

const service = require('./adminManagement.service');
const { sendSuccess } = require('../../utils/response');

const listPlatformStoreUsers = async (req, res, next) => {
    try {
        const result = await service.listPlatformStoreUsers(req.query);
        return sendSuccess(
            res,
            'Admin platform store users fetched successfully',
            result.data,
            200,
            result.pagination
        );
    } catch (err) {
        next(err);
    }
};

const listPlatformTransactions = async (req, res, next) => {
    try {
        const result = await service.listPlatformTransactions(req.query);
        return sendSuccess(
            res,
            'Admin platform transactions fetched successfully',
            {
                rows: result.rows,
                summary: result.summary,
                filters: result.filters,
            },
            200,
            result.pagination
        );
    } catch (err) {
        next(err);
    }
};

const listShippingWalletPayments = async (req, res, next) => {
    try {
        const result = await service.listShippingWalletPayments(req.query);
        return sendSuccess(
            res,
            'Admin shipping wallet payments fetched successfully',
            {
                rows: result.rows,
                summary: result.summary,
                filters: result.filters,
            },
            200,
            result.pagination
        );
    } catch (err) {
        next(err);
    }
};

const listGifts = async (req, res, next) => {
    try {
        const result = await service.listGifts(req.query);
        return sendSuccess(
            res,
            'Admin gifts fetched successfully',
            {
                rows: result.rows,
                summary: result.summary,
                filters: result.filters,
            },
            200,
            result.pagination
        );
    } catch (err) {
        next(err);
    }
};

const getGiftById = async (req, res, next) => {
    try {
        const result = await service.getGiftById(req.params.giftId);
        return sendSuccess(res, 'Admin gift fetched successfully', result);
    } catch (err) {
        next(err);
    }
};

const updateGiftStatus = async (req, res, next) => {
    try {
        const result = await service.updateGiftStatus(req.user, req.params.giftId, req.body);
        return sendSuccess(res, 'Gift status updated successfully', result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    listPlatformStoreUsers,
    listPlatformTransactions,
    listShippingWalletPayments,
    listGifts,
    getGiftById,
    updateGiftStatus,
};
