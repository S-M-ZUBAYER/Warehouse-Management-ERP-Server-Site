'use strict';

const { validationResult } = require('express-validator');
const service = require('./manualOrders.service');

const validationErrors = (errors) => errors.array().map((error) => ({
    field: error.path,
    message: error.msg,
}));

const handleValidation = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ status: false, message: 'Validation failed', errors: validationErrors(errors) });
        return false;
    }
    return true;
};

const getDropdowns = async (req, res, next) => {
    try {
        const data = await service.getManualOrderDropdowns(req.user);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const searchSkus = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.searchWarehouseSkus(req.user, req.query);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const getEasyParcelRates = async (req, res, next) => {
    try {
        const data = await service.getEasyParcelRates(req.user, req.query);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const getAfterShipConfig = async (req, res, next) => {
    try {
        const data = service.getAfterShipConfigStatus(req.query || {});
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const updateAfterShipApiKey = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = service.updateAfterShipApiKey(req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const getAfterShipCouriers = async (req, res, next) => {
    try {
        const data = await service.listAfterShipCouriers(req.user, req.query || {});
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const getAfterShipShipperAccounts = async (req, res, next) => {
    try {
        const data = await service.listAfterShipShipperAccounts(req.user, req.query || {});
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const getAfterShipRates = async (req, res, next) => {
    try {
        const data = await service.getAfterShipRates(req.user, req.query);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const getEasyParcelOAuthUrl = async (req, res, next) => {
    try {
        const data = service.buildEasyParcelLoginUrl(req.query || {});
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const exchangeEasyParcelOAuthCode = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.exchangeEasyParcelAuthorizationCode(req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const updateEasyParcelTokens = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = service.updateEasyParcelTokens(req.body || {});
        return res.json({ status: true, data, message: 'EasyParcel tokens updated successfully' });
    } catch (err) {
        next(err);
    }
};

const refreshEasyParcelToken = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.refreshEasyParcelAccountToken(req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const listManualOrders = async (req, res, next) => {
    try {
        const data = await service.listManualOrders(req.user, req.query);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const listAfterShipManualParcels = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.listAfterShipManualParcels(req.user, req.query);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};


const getManualOrderDetail = async (req, res, next) => {
    try {
        const data = await service.getManualOrderDetail(req.user, req.params.id);
        return res.json({ status: true, data });
    } catch (err) {
        next(err);
    }
};

const submitManualOrderToEasyParcel = async (req, res, next) => {
    try {
        const data = await service.submitManualOrderToEasyParcel(req.user, req.params.id);
        return res.json({ status: !data.easyParcelError, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const submitManualOrderToAfterShip = async (req, res, next) => {
    try {
        const data = await service.submitManualOrderToAfterShip(req.user, req.params.id);
        return res.json({ status: !data.afterShipError, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const refreshManualOrderShipmentStatus = async (req, res, next) => {
    try {
        const data = await service.refreshManualOrderShipmentStatus(req.user, req.params.id);
        return res.json({ status: !data.easyParcelError, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const refreshManualOrderAfterShipStatus = async (req, res, next) => {
    try {
        const data = await service.refreshManualOrderAfterShipStatus(req.user, req.params.id);
        return res.json({ status: !data.afterShipError, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const getEasyParcelShipmentDetails = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.getEasyParcelShipmentDetails(req.user, req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const getAfterShipLabelDetails = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.getAfterShipLabelDetails(req.user, req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const cancelManualOrderEasyParcel = async (req, res, next) => {
    try {
        const data = await service.cancelManualOrderEasyParcel(req.user, req.params.id, req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const cancelManualOrderAfterShip = async (req, res, next) => {
    try {
        const data = await service.cancelManualOrderAfterShip(req.user, req.params.id, req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const createManualOrderAfterShipPickup = async (req, res, next) => {
    try {
        const data = await service.createManualOrderAfterShipPickup(req.user, req.params.id, req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const updateManualOrderCodSettlement = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.updateManualOrderCodSettlement(req.user, req.params.id, req.body || {});
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const createManualOrder = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.createManualOrder(req.user, req.body);
        return res.status(201).json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};


const changePlatformOrderSku = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.changePlatformOrderSku(req.user, req.body);
        return res.json({ status: true, data, message: data.message });
    } catch (err) {
        next(err);
    }
};

const finalizePackedPlatformOrder = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) return;
        const data = await service.finalizePackedPlatformOrder(req.user, req.body);
        return res.json({ status: true, data, message: 'Packed stock finalized' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDropdowns,
    searchSkus,
    getEasyParcelRates,
    getAfterShipConfig,
    updateAfterShipApiKey,
    getAfterShipCouriers,
    getAfterShipShipperAccounts,
    getAfterShipRates,
    getEasyParcelOAuthUrl,
    exchangeEasyParcelOAuthCode,
    updateEasyParcelTokens,
    refreshEasyParcelToken,
    listManualOrders,
    listAfterShipManualParcels,
    getManualOrderDetail,
    createManualOrder,
    submitManualOrderToEasyParcel,
    submitManualOrderToAfterShip,
    refreshManualOrderShipmentStatus,
    refreshManualOrderAfterShipStatus,
    getEasyParcelShipmentDetails,
    getAfterShipLabelDetails,
    cancelManualOrderEasyParcel,
    cancelManualOrderAfterShip,
    createManualOrderAfterShipPickup,
    updateManualOrderCodSettlement,
    changePlatformOrderSku,
    finalizePackedPlatformOrder,
};
