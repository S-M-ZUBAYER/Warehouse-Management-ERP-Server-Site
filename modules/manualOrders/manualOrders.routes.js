'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const ctrl = require('./manualOrders.controller');

const router = express.Router();
const afterShipCountries = ['PH', 'VN', 'TH', 'ID', 'MY', 'SG'];
const easyParcelCountries = ['MY', 'SG', 'TH', 'ID'];

router.get('/manual-orders/dropdowns', ctrl.getDropdowns);
router.get('/manual-orders/sku-search', [
    query('warehouseId').notEmpty().withMessage('warehouseId is required').isInt({ min: 1 }),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
], ctrl.searchSkus);
router.get('/manual-orders/easyparcel/oauth/url', ctrl.getEasyParcelOAuthUrl);
router.get('/manual-orders/aftership/config', [
    query('country').optional().isIn(afterShipCountries),
], ctrl.getAfterShipConfig);
router.put('/manual-orders/aftership/api-key', [
    body('country').optional().isIn(afterShipCountries),
    body('apiKey').optional().isString(),
    body('api_key').optional().isString(),
    body('shipperAccountId').optional().isString(),
    body('shipper_account_id').optional().isString(),
    body('courierSlug').optional().isString(),
    body('courier_slug').optional().isString(),
    body('serviceType').optional().isString(),
    body('service_type').optional().isString(),
    body('mode').optional().isIn(['sandbox', 'production', 'prod']),
    body('persist').optional().isBoolean(),
], ctrl.updateAfterShipApiKey);
router.get('/manual-orders/aftership/couriers', [
    query('country').optional().isIn(afterShipCountries),
], ctrl.getAfterShipCouriers);
router.get('/manual-orders/aftership/shipper-accounts', [
    query('country').optional().isIn(afterShipCountries),
    query('slug').optional().isString(),
    query('courierSlug').optional().isString(),
    query('courier_slug').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('nextToken').optional().isString(),
    query('next_token').optional().isString(),
], ctrl.getAfterShipShipperAccounts);
router.get('/manual-orders/aftership/rates', [
    query('country').optional().isIn(afterShipCountries),
    query('senderCountry').optional().isIn(afterShipCountries),
    query('pickCountry').optional().isIn(afterShipCountries),
    query('sendCountry').optional().isIn(afterShipCountries),
    query('shipperAccountId').optional().isString(),
    query('shipper_account_id').optional().isString(),
], ctrl.getAfterShipRates);
router.get('/manual-orders/aftership/parcels', [
    query('country').optional().isIn([...afterShipCountries, 'ALL']),
    query('status').optional().isString(),
    query('paymentType').optional().isIn(['COD', 'PREPAID', 'ALL']),
    query('payment_type').optional().isIn(['COD', 'PREPAID', 'ALL']),
    query('dateFrom').optional().isISO8601(),
    query('date_from').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
    query('dateField').optional().isIn(['created_at', 'updated_at', 'order_time']),
    query('date_field').optional().isIn(['created_at', 'updated_at', 'order_time']),
    query('search').optional().isString(),
    query('liveStatus').optional().isBoolean(),
    query('live_status').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
], ctrl.listAfterShipManualParcels);
router.post('/manual-orders/easyparcel/oauth/exchange', [
    body('code').notEmpty().withMessage('EasyParcel authorization code is required'),
    body('country').optional().isIn(easyParcelCountries),
    body('state').optional().isString(),
    body('persist').optional().isBoolean(),
], ctrl.exchangeEasyParcelOAuthCode);
router.put('/manual-orders/easyparcel/tokens', [
    body('country').optional().isIn(easyParcelCountries),
    body('accessToken').optional().isString(),
    body('access_token').optional().isString(),
    body('refreshToken').optional().isString(),
    body('refresh_token').optional().isString(),
    body('tokenExpiresAt').optional().isString(),
    body('token_expires_at').optional().isString(),
    body('expiresIn').optional().isNumeric(),
    body('expires_in').optional().isNumeric(),
    body('persist').optional().isBoolean(),
], ctrl.updateEasyParcelTokens);
router.post('/manual-orders/easyparcel/tokens/refresh', [
    body('country').optional().isIn(easyParcelCountries),
    body('persist').optional().isBoolean(),
], ctrl.refreshEasyParcelToken);
router.get('/manual-orders/easyparcel/rates', ctrl.getEasyParcelRates);
router.post('/manual-orders/easyparcel/shipment-details', [
    body('country').optional().isIn(easyParcelCountries),
    body('shipmentNumber').optional().isString(),
    body('shipment_number').optional().isString(),
    body('easyParcelShipmentNumber').optional().isString(),
    body('easyparcel_shipment_number').optional().isString(),
    body('orderId').optional().isString(),
    body('order_id').optional().isString(),
], ctrl.getEasyParcelShipmentDetails);
router.post('/manual-orders/aftership/label-details', [
    body('country').optional().isIn(afterShipCountries),
    body('labelId').optional().isString(),
    body('label_id').optional().isString(),
    body('afterShipLabelId').optional().isString(),
    body('aftership_label_id').optional().isString(),
    body('orderId').optional().isString(),
    body('order_id').optional().isString(),
], ctrl.getAfterShipLabelDetails);
router.get('/manual-orders', ctrl.listManualOrders);
router.get('/manual-orders/:id', ctrl.getManualOrderDetail);
router.post('/manual-orders/:id/easyparcel/submit', ctrl.submitManualOrderToEasyParcel);
router.post('/manual-orders/:id/aftership/submit', ctrl.submitManualOrderToAfterShip);
router.post('/manual-orders/:id/easyparcel/status', ctrl.refreshManualOrderShipmentStatus);
router.post('/manual-orders/:id/aftership/status', ctrl.refreshManualOrderAfterShipStatus);
router.post('/manual-orders/:id/easyparcel/cancel', [
    body('remark').optional().isString(),
], ctrl.cancelManualOrderEasyParcel);
router.post('/manual-orders/:id/aftership/cancel', [
    body('reason').optional().isString(),
    body('remark').optional().isString(),
], ctrl.cancelManualOrderAfterShip);
router.post('/manual-orders/:id/aftership/pickup', [
    body('pickupDate').optional().isString(),
    body('pickup_date').optional().isString(),
    body('pickupStartTime').optional().isString(),
    body('pickup_start_time').optional().isString(),
    body('pickupEndTime').optional().isString(),
    body('pickup_end_time').optional().isString(),
], ctrl.createManualOrderAfterShipPickup);
router.patch('/manual-orders/:id/cod-settlement', [
    body('codStatus').optional().isString(),
    body('cod_status').optional().isString(),
    body('paidAmount').optional().isNumeric(),
    body('paid_amount').optional().isNumeric(),
    body('settlementAmount').optional().isNumeric(),
    body('settlement_amount').optional().isNumeric(),
    body('paidAt').optional().isString(),
    body('paid_at').optional().isString(),
    body('reference').optional().isString(),
    body('note').optional().isString(),
], ctrl.updateManualOrderCodSettlement);
router.post('/manual-orders', [
    body('warehouseId').notEmpty().withMessage('warehouseId is required').isInt({ min: 1 }),
    body('type').optional().isIn(['manual_order', 'gift']),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.quantity').notEmpty().isInt({ min: 1 }).withMessage('item quantity must be at least 1'),
], ctrl.createManualOrder);
router.post('/platform-orders/change-sku-mapping', [
    body('platform').notEmpty().isIn(['shopee', 'tiktok']),
    body('merchantSkuId').optional({ nullable: true }).isInt({ min: 1 }),
    body('combineSkuId').optional({ nullable: true }).isInt({ min: 1 }),
    body('warehouseId').notEmpty().isInt({ min: 1 }),
    body('order').notEmpty().withMessage('order is required'),
    body('item').notEmpty().withMessage('item is required'),
    body().custom((value) => {
        const merchantSkuId = Number(value.merchantSkuId || value.item?.merchantSkuId || 0);
        const combineSkuId = Number(value.combineSkuId || value.item?.combineSkuId || 0);
        const hasMerchantSku = Number.isInteger(merchantSkuId) && merchantSkuId > 0;
        const hasCombineSku = Number.isInteger(combineSkuId) && combineSkuId > 0;
        if (hasMerchantSku === hasCombineSku) {
            throw new Error('Exactly one of merchantSkuId or combineSkuId is required');
        }
        return true;
    }),
], ctrl.changePlatformOrderSku);
router.post('/platform-orders/pack-stock', [
    body('platform').notEmpty().isIn(['shopee', 'tiktok']),
    body('order.items').isArray({ min: 1 }).withMessage('order.items must be a non-empty array'),
], ctrl.finalizePackedPlatformOrder);

module.exports = router;
