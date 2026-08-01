'use strict';

const { Op } = require('sequelize');

const toPositiveInt = (value, fieldName = 'quantity') => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        const err = new Error(`${fieldName} must be a positive integer`);
        err.statusCode = 400;
        throw err;
    }
    return parsed;
};

const getLineSkuRef = (line = {}) => {
    const merchantSkuId = Number(line.merchantSkuId || line.merchant_sku_id || line.skuId || line.id || 0);
    const combineSkuId = Number(line.combineSkuId || line.combine_sku_id || 0);
    const hasMerchant = Number.isInteger(merchantSkuId) && merchantSkuId > 0;
    const hasCombine = Number.isInteger(combineSkuId) && combineSkuId > 0;
    if (hasMerchant === hasCombine) {
        const err = new Error('Each line must include exactly one of merchantSkuId or combineSkuId');
        err.statusCode = 400;
        throw err;
    }
    return hasCombine
        ? { kind: 'combine', combineSkuId, key: `combine:${combineSkuId}` }
        : { kind: 'merchant', merchantSkuId, key: `merchant:${merchantSkuId}` };
};

const getCombineAvailability = async ({ companyId, combineSkuId, warehouseId, transaction = null }) => {
    const { CombineSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');
    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: companyId, deleted_at: null, status: 'active' },
        attributes: ['id', 'warehouse_id'],
        raw: true,
        ...(transaction ? { transaction } : {}),
    });
    if (!combineSku) return null;
    if (warehouseId && combineSku.warehouse_id && Number(combineSku.warehouse_id) !== Number(warehouseId)) return null;

    const items = await CombineSkuItem.findAll({
        where: { company_id: companyId, combine_sku_id: combineSkuId },
        attributes: ['merchant_sku_id', 'quantity'],
        raw: true,
        ...(transaction ? { transaction } : {}),
    });
    if (!items.length) return { available: 0, items: [] };

    const childIds = items.map((item) => Number(item.merchant_sku_id));
    const stocks = await SkuWarehouseStock.findAll({
        where: {
            company_id: companyId,
            merchant_sku_id: { [Op.in]: childIds },
            ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        },
        attributes: ['merchant_sku_id', 'qty_on_hand', 'qty_reserved'],
        raw: true,
        ...(transaction ? { transaction } : {}),
    });

    const stockBySku = new Map();
    for (const stock of stocks) {
        const id = Number(stock.merchant_sku_id);
        const current = stockBySku.get(id) || { onHand: 0, reserved: 0 };
        current.onHand += Number(stock.qty_on_hand || 0);
        current.reserved += Number(stock.qty_reserved || 0);
        stockBySku.set(id, current);
    }

    const possible = items.map((item) => {
        const ratio = Number(item.quantity || 0);
        const stock = stockBySku.get(Number(item.merchant_sku_id)) || { onHand: 0, reserved: 0 };
        if (ratio <= 0) return 0;
        return Math.floor(Math.max(0, stock.onHand - stock.reserved) / ratio);
    });

    return { available: Math.max(0, Math.min(...possible)), items };
};

const deductMerchantStock = async ({ user, companyId, merchantSkuId, warehouseId, quantity, referenceType, referenceId, notes, movementType = 'sale_deduction', transaction }) => {
    const { SkuWarehouseStock, StockLedgerEntry } = require('../../models');
    const stockRecord = await SkuWarehouseStock.findOne({
        where: { company_id: companyId, merchant_sku_id: merchantSkuId, warehouse_id: warehouseId },
        lock: transaction.LOCK.UPDATE,
        transaction,
    });
    const available = Math.max(0, Number(stockRecord?.qty_on_hand || 0) - Number(stockRecord?.qty_reserved || 0));
    if (!stockRecord || available < quantity) {
        const err = new Error(`Insufficient available stock for merchant SKU ${merchantSkuId}: available ${available}, requested ${quantity}`);
        err.statusCode = 400;
        throw err;
    }
    const before = Number(stockRecord.qty_on_hand || 0);
    const after = before - quantity;
    await stockRecord.update({ qty_on_hand: after }, { transaction });
    await StockLedgerEntry.create({
        company_id: companyId,
        merchant_sku_id: merchantSkuId,
        warehouse_id: warehouseId,
        sku_warehouse_stock_id: stockRecord.id,
        movement_type: movementType,
        quantity_delta: -quantity,
        qty_on_hand_after: after,
        reference_type: referenceType,
        reference_id: String(referenceId),
        notes,
        created_by: user.userId || user.id || null,
    }, { transaction });
    return { merchantSkuId, deductedQty: quantity, qtyOnHandBefore: before, qtyOnHandAfter: after };
};

const deductSellableStock = async ({ user, companyId, line, warehouseId, quantity, referenceType, referenceId, notes, movementType, transaction }) => {
    const ref = getLineSkuRef(line);
    if (ref.kind === 'merchant') {
        const result = await deductMerchantStock({ user, companyId, merchantSkuId: ref.merchantSkuId, warehouseId, quantity, referenceType, referenceId, notes, movementType, transaction });
        return { ref, childDeductions: [result], platformDeduction: { merchantSkuId: ref.merchantSkuId, warehouseId, quantity } };
    }

    const availability = await getCombineAvailability({ companyId, combineSkuId: ref.combineSkuId, warehouseId, transaction });
    if (!availability) {
        const err = new Error(`Combine SKU ${ref.combineSkuId} not found for selected warehouse`);
        err.statusCode = 404;
        throw err;
    }
    if (availability.available < quantity) {
        const err = new Error(`Insufficient available stock for combine SKU ${ref.combineSkuId}: available ${availability.available}, requested ${quantity}`);
        err.statusCode = 400;
        throw err;
    }

    const childDeductions = [];
    for (const item of availability.items) {
        const childQty = Number(item.quantity || 0) * quantity;
        if (childQty <= 0) continue;
        const result = await deductMerchantStock({
            user,
            companyId,
            merchantSkuId: Number(item.merchant_sku_id),
            warehouseId,
            quantity: childQty,
            referenceType,
            referenceId,
            notes: `${notes || 'Combine SKU deduction'} - combine SKU ${ref.combineSkuId} x ${quantity}, child ratio ${item.quantity}`,
            movementType,
            transaction,
        });
        childDeductions.push({ ...result, combineSkuId: ref.combineSkuId, combineRatio: Number(item.quantity || 0) });
    }

    return { ref, childDeductions, platformDeduction: { combineSkuId: ref.combineSkuId, warehouseId, quantity } };
};

const restoreMerchantStock = async ({ user, companyId, merchantSkuId, warehouseId, quantity, referenceType, referenceId, notes, transaction }) => {
    const { SkuWarehouseStock, StockLedgerEntry } = require('../../models');
    const stockRecord = await SkuWarehouseStock.findOne({
        where: { company_id: companyId, merchant_sku_id: merchantSkuId, warehouse_id: warehouseId },
        lock: transaction.LOCK.UPDATE,
        transaction,
    });
    if (!stockRecord) return null;
    const after = Number(stockRecord.qty_on_hand || 0) + quantity;
    await stockRecord.update({ qty_on_hand: after }, { transaction });
    await StockLedgerEntry.create({
        company_id: companyId,
        merchant_sku_id: merchantSkuId,
        warehouse_id: warehouseId,
        sku_warehouse_stock_id: stockRecord.id,
        movement_type: 'return',
        quantity_delta: quantity,
        qty_on_hand_after: after,
        reference_type: referenceType,
        reference_id: String(referenceId),
        notes,
        created_by: user.userId || user.id || null,
    }, { transaction });
    return { merchantSkuId, quantityDelta: quantity, warehouseId };
};

const restoreSellableStock = async ({ user, companyId, item, referenceType, referenceId, notes, transaction }) => {
    const ref = getLineSkuRef(item);
    const warehouseId = Number(item.warehouseId || item.warehouse_id);
    const quantity = Number(item.quantity || item.qty || item.qty_expected || 0);
    if (!warehouseId || quantity <= 0) return { ref, restored: [] };

    if (ref.kind === 'merchant') {
        const result = await restoreMerchantStock({ user, companyId, merchantSkuId: ref.merchantSkuId, warehouseId, quantity, referenceType, referenceId, notes, transaction });
        return { ref, restored: result ? [result] : [] };
    }

    const availability = await getCombineAvailability({ companyId, combineSkuId: ref.combineSkuId, warehouseId, transaction });
    const restored = [];
    for (const child of availability?.items || []) {
        const result = await restoreMerchantStock({
            user,
            companyId,
            merchantSkuId: Number(child.merchant_sku_id),
            warehouseId,
            quantity: Number(child.quantity || 0) * quantity,
            referenceType,
            referenceId,
            notes: `${notes || 'Combine SKU stock restored'} - combine SKU ${ref.combineSkuId}`,
            transaction,
        });
        if (result) restored.push(result);
    }
    return { ref, restored };
};

module.exports = {
    toPositiveInt,
    getLineSkuRef,
    getCombineAvailability,
    deductSellableStock,
    restoreSellableStock,
};
