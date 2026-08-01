


'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');
const { mirrorStockChange } = require('../skuSyncGroup/skuSyncGroup.service');
const { applyWarehouseScope, assertWarehousePermission } = require('../../utils/permissions');

// ─── Recompute a single combined SKU's computed_quantity ──────────────────────
// Formula: MIN(FLOOR(component warehouse qty_on_hand / item.quantity)).
// Called directly by the worker AND can be called inline for small operations
const recomputeCombineSku = async (companyId, combineSkuId, t = null) => {
    const { CombineSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');

    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: companyId, deleted_at: null },
        attributes: ['id', 'warehouse_id'],
        raw: true,
        ...(t ? { transaction: t } : {}),
    });

    if (!combineSku) return 0;

    const items = await CombineSkuItem.findAll({
        where: { combine_sku_id: combineSkuId, company_id: companyId },
        attributes: ['merchant_sku_id', 'quantity'],
        raw: true,
        ...(t ? { transaction: t } : {}),
    });

    if (!items.length) return 0;

    const qtyPerSku = await Promise.all(items.map(async (item) => {
        const stockWhere = {
            merchant_sku_id: item.merchant_sku_id,
            company_id: companyId,
        };
        if (combineSku.warehouse_id) stockWhere.warehouse_id = combineSku.warehouse_id;

        const result = await SkuWarehouseStock.findOne({
            where: stockWhere,
            attributes: [[sequelize.fn('SUM', sequelize.col('qty_on_hand')), 'total']],
            raw: true,
            ...(t ? { transaction: t } : {}),
        });
        const totalQty = Number(result?.total || 0);
        return Math.floor(totalQty / item.quantity);
    }));

    const computedQty = Math.max(0, Math.min(...qtyPerSku));

    await CombineSku.update(
        { computed_quantity: computedQty },
        {
            where: { id: combineSkuId, company_id: companyId },
            ...(t ? { transaction: t } : {}),
        }
    );

    return computedQty;
};

// ─── Get stock for a single merchant SKU (all warehouses) ────────────────────
const getStockByMerchantSku = async (user, merchantSkuId) => {
    const { MerchantSku, SkuWarehouseStock, Warehouse } = require('../../models');

    const sku = await MerchantSku.findOne({
        where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
        attributes: ['id', 'sku_name', 'sku_title', 'status'],
    });
    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    const stockRows = await SkuWarehouseStock.findAll({
        where: { merchant_sku_id: merchantSkuId, company_id: user.companyId },
        include: [{ model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'] }],
        order: [['warehouse_id', 'ASC']],
    });

    const totals = stockRows.reduce((acc, s) => ({
        qty_on_hand: acc.qty_on_hand + (s.qty_on_hand || 0),
        qty_reserved: acc.qty_reserved + (s.qty_reserved || 0),
        qty_inbound: acc.qty_inbound + (s.qty_inbound || 0),
        qty_available: acc.qty_available + Math.max(0, (s.qty_on_hand || 0) - (s.qty_reserved || 0)),
    }), { qty_on_hand: 0, qty_reserved: 0, qty_inbound: 0, qty_available: 0 });

    return {
        merchantSku: sku,
        totals,
        byWarehouse: stockRows,
    };
};

// ─── Get stock for a combined SKU ─────────────────────────────────────────────
const getStockByCombineSku = async (user, combineSkuId) => {
    const { CombineSku, CombineSkuItem, MerchantSku, SkuWarehouseStock } = require('../../models');

    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: user.companyId, deleted_at: null },
        attributes: ['id', 'combine_name', 'combine_sku_code', 'computed_quantity', 'status'],
        include: [{
            model: CombineSkuItem, as: 'items',
            include: [{
                model: MerchantSku, as: 'merchantSku',
                attributes: ['id', 'sku_name', 'sku_title'],
                include: [{
                    model: SkuWarehouseStock, as: 'stock',
                    attributes: ['qty_on_hand', 'qty_reserved', 'qty_inbound'],
                }],
            }],
        }],
    });

    if (!combineSku) {
        const err = new Error('Combine SKU not found');
        err.statusCode = 404;
        throw err;
    }

    return combineSku;
};

// ─── Bulk stock query (Java uses this for startup sync) ───────────────────────
const getBulkStock = async (user, { merchantSkuIds = [], combineSkuIds = [] }) => {
    const { SkuWarehouseStock, CombineSku } = require('../../models');

    const [merchantStock, combineSkus] = await Promise.all([
        merchantSkuIds.length
            ? SkuWarehouseStock.findAll({
                where: {
                    merchant_sku_id: { [Op.in]: merchantSkuIds },
                    company_id: user.companyId,
                },
                attributes: ['merchant_sku_id', 'warehouse_id', 'qty_on_hand', 'qty_reserved', 'qty_inbound'],
                raw: true,
            })
            : [],
        combineSkuIds.length
            ? CombineSku.findAll({
                where: { id: { [Op.in]: combineSkuIds }, company_id: user.companyId, deleted_at: null },
                attributes: ['id', 'computed_quantity'],
                raw: true,
            })
            : [],
    ]);

    // Aggregate merchant stock by SKU ID (sum across warehouses)
    const merchantMap = {};
    for (const row of merchantStock) {
        if (!merchantMap[row.merchant_sku_id]) {
            merchantMap[row.merchant_sku_id] = { qty_on_hand: 0, qty_reserved: 0, qty_inbound: 0, qty_available: 0 };
        }
        merchantMap[row.merchant_sku_id].qty_on_hand += row.qty_on_hand || 0;
        merchantMap[row.merchant_sku_id].qty_reserved += row.qty_reserved || 0;
        merchantMap[row.merchant_sku_id].qty_inbound += row.qty_inbound || 0;
        merchantMap[row.merchant_sku_id].qty_available += Math.max(0, (row.qty_on_hand || 0) - (row.qty_reserved || 0));
    }

    return {
        merchantSkus: merchantMap,
        combineSkus: Object.fromEntries(combineSkus.map(c => [c.id, { computed_quantity: c.computed_quantity }])),
    };
};

// ─── Manual stock adjustment ──────────────────────────────────────────────────
const manualAdjustStock = async (user, data) => {
    const { MerchantSku, SkuWarehouseStock, StockLedgerEntry, CombineSkuItem } = require('../../models');
    const { merchantSkuId, warehouseId, adjustmentQty, notes } = data;

    const sku = await MerchantSku.findOne({
        where: { id: merchantSkuId, company_id: user.companyId, deleted_at: null },
    });
    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    let newQtyOnHand;
    let stockRecord;
    const affectedSkuIds = [merchantSkuId];

    await sequelize.transaction(async (t) => {
        [stockRecord] = await SkuWarehouseStock.findOrCreate({
            where: { merchant_sku_id: merchantSkuId, warehouse_id: warehouseId },
            defaults: { company_id: user.companyId, qty_on_hand: 0, qty_reserved: 0, qty_inbound: 0 },
            lock: t.LOCK.UPDATE,
            transaction: t,
        });

        newQtyOnHand = (stockRecord.qty_on_hand || 0) + adjustmentQty;
        if (newQtyOnHand < 0) {
            const err = new Error(`Adjustment would result in negative stock (current: ${stockRecord.qty_on_hand})`);
            err.statusCode = 400;
            throw err;
        }

        await stockRecord.update({ qty_on_hand: newQtyOnHand }, { transaction: t });

        await StockLedgerEntry.create({
            company_id: user.companyId,
            merchant_sku_id: merchantSkuId,
            warehouse_id: warehouseId,
            sku_warehouse_stock_id: stockRecord.id,
            movement_type: 'manual_adjustment',
            quantity_delta: adjustmentQty,
            qty_on_hand_after: newQtyOnHand,
            reference_type: 'manual',
            reference_id: `ADJ-${Date.now()}`,
            notes: notes || 'Manual stock adjustment',
            created_by: user.userId,
        }, { transaction: t });

        // Mirror manual adjustment to sync group members
        const mirroredSkuIds = await mirrorStockChange(
            t,
            user,
            merchantSkuId,
            adjustmentQty,    // positive = add, negative = deduct
            warehouseId
        );
        affectedSkuIds.push(...mirroredSkuIds);
    });

    // Queue combine SKU recompute
    const combineItems = await CombineSkuItem.findAll({
        where: { merchant_sku_id: { [Op.in]: [...new Set(affectedSkuIds)] }, company_id: user.companyId },
        attributes: ['combine_sku_id'],
        raw: true,
    });
    if (combineItems.length) {
        const ids = [...new Set(combineItems.map(i => i.combine_sku_id))];
        const pipeline = redis.client.multi();
        ids.forEach(id =>
            pipeline.rPush('queue:combine_sku_recompute', JSON.stringify({ companyId: user.companyId, combineSkuId: id }))
        );
        await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
    }

    return {
        merchantSkuId,
        warehouseId,
        adjustmentQty,
        newQtyOnHand,
    };
};

// ─── Stock reserve / pack flow for platform orders ───────────────────────────
// Reservation (order placed): qty_reserved increases, qty_on_hand stays unchanged.
// Pack (order packed): qty_on_hand and qty_reserved decrease together.
const toPositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        const err = new Error(`${fieldName} must be a positive integer`);
        err.statusCode = 400;
        throw err;
    }
    return parsed;
};

const saleLineWhere = ({ platformMappingId, platformOrderId, platformOrderItemId }) => ({
    platform_sku_mapping_id: platformMappingId,
    platform_order_id: platformOrderId,
    platform_order_item_id: platformOrderItemId || null,
});

const queueCombineSkuRecomputeForAffectedSkus = async (companyId, affectedSkuIds = [], combineSkuId = null) => {
    const queueItems = [];
    if (combineSkuId) queueItems.push(combineSkuId);

    const uniqueAffectedSkuIds = [...new Set(affectedSkuIds.filter(Boolean).map((id) => Number(id)))];
    if (uniqueAffectedSkuIds.length) {
        const { CombineSkuItem: CSI } = require('../../models');
        const linkedCombines = await CSI.findAll({
            where: { merchant_sku_id: { [Op.in]: uniqueAffectedSkuIds }, company_id: companyId },
            attributes: ['combine_sku_id'],
            group: ['combine_sku_id'],
            raw: true,
        });
        linkedCombines.forEach(({ combine_sku_id }) => queueItems.push(combine_sku_id));
    }

    const uniqueCombineIds = [...new Set(queueItems.filter(Boolean).map((id) => Number(id)))];
    if (!uniqueCombineIds.length) return;

    const pipeline = redis.client.multi();
    uniqueCombineIds.forEach((id) =>
        pipeline.rPush('queue:combine_sku_recompute', JSON.stringify({ companyId, combineSkuId: id }))
    );
    await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
};

const resolveActivePlatformMapping = async (user, platformMappingId) => {
    const { PlatformSkuMapping, PlatformStore } = require('../../models');
    const mapping = await PlatformSkuMapping.findOne({
        where: { id: platformMappingId, company_id: user.companyId, is_active: true, deleted_at: null },
        include: [{ model: PlatformStore, as: 'platformStore', attributes: ['id', 'platform'] }],
    });

    if (!mapping) {
        const err = new Error('Platform SKU mapping not found or inactive');
        err.statusCode = 404;
        throw err;
    }
    return mapping;
};

const lockStockRecord = async ({ SkuWarehouseStock, merchantSkuId, warehouseId, user, transaction }) => {
    const stockRecord = await SkuWarehouseStock.findOne({
        where: { merchant_sku_id: merchantSkuId, warehouse_id: warehouseId, company_id: user.companyId },
        lock: transaction.LOCK.UPDATE,
        transaction,
    });

    if (!stockRecord) {
        const err = new Error(`No stock record for merchant SKU ${merchantSkuId} in warehouse ${warehouseId}`);
        err.statusCode = 400;
        throw err;
    }
    return stockRecord;
};

const reserveOneStockRecord = async ({ stockRecord, quantity, merchantSkuId, transaction }) => {
    const qtyOnHand = Number(stockRecord.qty_on_hand || 0);
    const qtyReserved = Number(stockRecord.qty_reserved || 0);
    const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);

    if (qtyAvailable < quantity) {
        const err = new Error(`Insufficient available stock for merchant SKU ${merchantSkuId}: available ${qtyAvailable}, requested ${quantity}`);
        err.statusCode = 400;
        throw err;
    }

    const newQtyReserved = qtyReserved + quantity;
    await stockRecord.update({ qty_reserved: newQtyReserved }, { transaction });

    return {
        merchantSkuId,
        reservedQty: quantity,
        newQtyOnHand: qtyOnHand,
        newQtyReserved,
        qtyAvailableAfter: Math.max(0, qtyOnHand - newQtyReserved),
    };
};

const packOneStockRecord = async ({ stockRecord, quantity, merchantSkuId, warehouseId, platformOrderId, platformLabel, user, transaction, notes }) => {
    const { StockLedgerEntry } = require('../../models');
    const qtyOnHand = Number(stockRecord.qty_on_hand || 0);
    const qtyReserved = Number(stockRecord.qty_reserved || 0);

    if (qtyOnHand < quantity) {
        const err = new Error(`Insufficient total stock for merchant SKU ${merchantSkuId}: total available ${qtyOnHand}, requested ${quantity}`);
        err.statusCode = 400;
        throw err;
    }

    const newQtyOnHand = qtyOnHand - quantity;
    const newQtyReserved = Math.max(0, qtyReserved - quantity);

    await stockRecord.update({
        qty_on_hand: newQtyOnHand,
        qty_reserved: newQtyReserved,
    }, { transaction });

    await StockLedgerEntry.create({
        company_id: user.companyId,
        merchant_sku_id: merchantSkuId,
        warehouse_id: warehouseId,
        sku_warehouse_stock_id: stockRecord.id,
        movement_type: 'sale_deduction',
        quantity_delta: -quantity,
        qty_on_hand_after: newQtyOnHand,
        reference_type: 'platform_order',
        reference_id: platformOrderId,
        notes: notes || `Packed on ${platformLabel || 'platform'} — order ${platformOrderId}`,
        created_by: user.userId,
    }, { transaction });

    return {
        merchantSkuId,
        deductedQty: quantity,
        newQtyOnHand,
        newQtyReserved,
        qtyAvailableAfter: Math.max(0, newQtyOnHand - newQtyReserved),
    };
};

// Called by Shopee/TikTok webhook workers when an order is placed.
const deductStock = async (user, data) => {
    const { OrderSaleLine, CombineSkuItem, SkuWarehouseStock } = require('../../models');
    const { platformMappingId, platformOrderId, platformOrderItemId } = data;
    const quantitySold = toPositiveInt(data.quantitySold, 'quantitySold');

    if (!platformMappingId || !platformOrderId) {
        const err = new Error('platformMappingId and platformOrderId are required');
        err.statusCode = 400;
        throw err;
    }

    const mapping = await resolveActivePlatformMapping(user, platformMappingId);
    const where = saleLineWhere({ platformMappingId, platformOrderId, platformOrderItemId });

    const existing = await OrderSaleLine.findOne({ where });
    if (existing) {
        return {
            alreadyDeducted: Boolean(existing.deducted),
            alreadyReserved: !existing.deducted,
            saleLineId: existing.id,
            platformOrderId,
            deductions: [],
            combineSkuId: mapping.combine_sku_id || null,
        };
    }

    const warehouseId = mapping.fulfillment_warehouse_id;
    if (!warehouseId) {
        const err = new Error('Platform SKU mapping is missing fulfillment warehouse');
        err.statusCode = 400;
        throw err;
    }

    const deductions = [];
    const affectedSkus = [];
    let saleLine;

    await sequelize.transaction(async (t) => {
        if (mapping.merchant_sku_id) {
            const stockRecord = await lockStockRecord({
                SkuWarehouseStock,
                merchantSkuId: mapping.merchant_sku_id,
                warehouseId,
                user,
                transaction: t,
            });

            const result = await reserveOneStockRecord({
                stockRecord,
                quantity: quantitySold,
                merchantSkuId: mapping.merchant_sku_id,
                transaction: t,
            });
            deductions.push(result);
            affectedSkus.push(mapping.merchant_sku_id);
        } else if (mapping.combine_sku_id) {
            const items = await CombineSkuItem.findAll({
                where: { combine_sku_id: mapping.combine_sku_id, company_id: user.companyId },
                attributes: ['merchant_sku_id', 'quantity'],
                transaction: t,
            });

            if (!items.length) {
                const err = new Error(`Combined SKU ${mapping.combine_sku_id} has no child SKU items`);
                err.statusCode = 400;
                throw err;
            }

            for (const item of items) {
                const reserveQty = Number(item.quantity || 0) * quantitySold;
                const stockRecord = await lockStockRecord({
                    SkuWarehouseStock,
                    merchantSkuId: item.merchant_sku_id,
                    warehouseId,
                    user,
                    transaction: t,
                });
                const result = await reserveOneStockRecord({
                    stockRecord,
                    quantity: reserveQty,
                    merchantSkuId: item.merchant_sku_id,
                    transaction: t,
                });
                deductions.push({ ...result, combineRatio: item.quantity });
                affectedSkus.push(item.merchant_sku_id);
            }
        } else {
            const err = new Error('Platform SKU mapping must link to either a merchant SKU or combine SKU');
            err.statusCode = 400;
            throw err;
        }

        saleLine = await OrderSaleLine.create({
            company_id: user.companyId,
            platform_sku_mapping_id: platformMappingId,
            platform_order_id: platformOrderId,
            platform_order_item_id: platformOrderItemId || null,
            quantity_sold: quantitySold,
            deducted: false,
            deducted_at: null,
            sold_at: new Date(),
        }, { transaction: t });
    });

    await queueCombineSkuRecomputeForAffectedSkus(user.companyId, affectedSkus, mapping.combine_sku_id || null);

    return {
        alreadyDeducted: false,
        alreadyReserved: false,
        saleLineId: saleLine?.id || null,
        platformOrderId,
        deductions,
        combineSkuId: mapping.combine_sku_id || null,
    };
};

// Called when the user presses Pack after the platform successfully moves to packed/processed.
const packReservedStock = async (user, data) => {
    const { OrderSaleLine, CombineSkuItem, SkuWarehouseStock } = require('../../models');
    const { platformMappingId, platformOrderId, platformOrderItemId } = data;
    const quantitySold = toPositiveInt(data.quantitySold, 'quantitySold');
    const overrideMerchantSkuId = Number(data.overrideMerchantSkuId || 0);
    const overrideCombineSkuId = Number(data.overrideCombineSkuId || 0);
    const overrideWarehouseId = Number(data.overrideWarehouseId || 0);
    const hasMerchantSkuOverride = Number.isInteger(overrideMerchantSkuId) && overrideMerchantSkuId > 0;
    const hasCombineSkuOverride = Number.isInteger(overrideCombineSkuId) && overrideCombineSkuId > 0;
    const hasSkuOverride = hasMerchantSkuOverride || hasCombineSkuOverride;

    if (!platformMappingId || !platformOrderId) {
        const err = new Error('platformMappingId and platformOrderId are required');
        err.statusCode = 400;
        throw err;
    }

    const mapping = await resolveActivePlatformMapping(user, platformMappingId);
    const where = saleLineWhere({ platformMappingId, platformOrderId, platformOrderItemId });
    const warehouseId = hasSkuOverride ? overrideWarehouseId : mapping.fulfillment_warehouse_id;

    if (!warehouseId) {
        const err = new Error(hasSkuOverride ? 'Replacement warehouse is required' : 'Platform SKU mapping is missing fulfillment warehouse');
        err.statusCode = 400;
        throw err;
    }

    const currentLine = await OrderSaleLine.findOne({ where });
    if (currentLine?.deducted) {
        return {
            alreadyPacked: true,
            alreadyDeducted: true,
            saleLineId: currentLine.id,
            platformOrderId,
            deductions: [],
            combineSkuId: mapping.combine_sku_id || null,
        };
    }

    const deductions = [];
    const affectedSkus = [];
    let saleLineId = currentLine?.id || null;
    const platformLabel = mapping.platformStore?.platform || 'platform';
    const packMerchantSkuId = hasCombineSkuOverride
        ? null
        : hasMerchantSkuOverride
            ? overrideMerchantSkuId
            : mapping.merchant_sku_id;
    const packCombineSkuId = hasCombineSkuOverride
        ? overrideCombineSkuId
        : hasMerchantSkuOverride
            ? null
            : mapping.combine_sku_id;
    const packNotes = hasMerchantSkuOverride
        ? `Packed replacement SKU ${overrideMerchantSkuId} for ${platformLabel} order ${platformOrderId}`
        : hasCombineSkuOverride
            ? `Packed replacement combine SKU ${overrideCombineSkuId} for ${platformLabel} order ${platformOrderId}`
        : undefined;

    await sequelize.transaction(async (t) => {
        const saleLine = currentLine
            ? await OrderSaleLine.findOne({ where, lock: t.LOCK.UPDATE, transaction: t })
            : null;

        if (saleLine?.deducted) {
            saleLineId = saleLine.id;
            return;
        }

        if (packCombineSkuId) {
            const items = await CombineSkuItem.findAll({
                where: { combine_sku_id: packCombineSkuId, company_id: user.companyId },
                attributes: ['merchant_sku_id', 'quantity'],
                transaction: t,
            });

            if (!items.length) {
                const err = new Error(`Combined SKU ${packCombineSkuId} has no child SKU items`);
                err.statusCode = 400;
                throw err;
            }

            for (const item of items) {
                const deductQty = Number(item.quantity || 0) * quantitySold;
                const stockRecord = await lockStockRecord({
                    SkuWarehouseStock,
                    merchantSkuId: item.merchant_sku_id,
                    warehouseId,
                    user,
                    transaction: t,
                });
                const result = await packOneStockRecord({
                    stockRecord,
                    quantity: deductQty,
                    merchantSkuId: item.merchant_sku_id,
                    warehouseId,
                    platformOrderId,
                    platformLabel,
                    user,
                    transaction: t,
                    notes: packNotes || `Part of combine SKU ${packCombineSkuId} - packed ${quantitySold} units x ratio ${item.quantity}`,
                });
                deductions.push({ ...result, combineRatio: item.quantity, overrideApplied: hasCombineSkuOverride });
                affectedSkus.push(item.merchant_sku_id);
            }
        } else if (packMerchantSkuId) {
            const stockRecord = await lockStockRecord({
                SkuWarehouseStock,
                merchantSkuId: packMerchantSkuId,
                warehouseId,
                user,
                transaction: t,
            });
            const result = await packOneStockRecord({
                stockRecord,
                quantity: quantitySold,
                merchantSkuId: packMerchantSkuId,
                warehouseId,
                platformOrderId,
                platformLabel,
                user,
                transaction: t,
                notes: packNotes,
            });
            deductions.push(hasMerchantSkuOverride ? { ...result, overrideApplied: true } : result);
            affectedSkus.push(packMerchantSkuId);

            if (!hasSkuOverride) {
                const mirroredSkuIds = await mirrorStockChange(
                    t,
                    user,
                    packMerchantSkuId,
                    -quantitySold,
                    warehouseId
                );
                affectedSkus.push(...mirroredSkuIds);
            }
        } else {
            const err = new Error('Platform SKU mapping must link to either a merchant SKU or combine SKU');
            err.statusCode = 400;
            throw err;
        }

        if (saleLine) {
            await saleLine.update({
                quantity_sold: quantitySold,
                deducted: true,
                deducted_at: new Date(),
            }, { transaction: t });
            saleLineId = saleLine.id;
        } else {
            const created = await OrderSaleLine.create({
                company_id: user.companyId,
                platform_sku_mapping_id: platformMappingId,
                platform_order_id: platformOrderId,
                platform_order_item_id: platformOrderItemId || null,
                quantity_sold: quantitySold,
                deducted: true,
                deducted_at: new Date(),
                sold_at: new Date(),
            }, { transaction: t });
            saleLineId = created.id;
        }
    });

    await queueCombineSkuRecomputeForAffectedSkus(user.companyId, affectedSkus, packCombineSkuId || null);

    return {
        alreadyPacked: false,
        alreadyDeducted: true,
        saleLineId,
        platformOrderId,
        deductions,
        combineSkuId: packCombineSkuId || null,
        overrideApplied: hasSkuOverride,
        overrideMerchantSkuId: hasMerchantSkuOverride ? overrideMerchantSkuId : null,
        overrideCombineSkuId: hasCombineSkuOverride ? overrideCombineSkuId : null,
        overrideWarehouseId: hasSkuOverride ? overrideWarehouseId : null,
    };
};

// ─── Get ledger / history for a SKU ──────────────────────────────────────────
const getStockLedger = async (user, { merchantSkuId, warehouseId, skuName, movementType, startDate, endDate, page = 1, limit = 30 }) => {
    const { StockLedgerEntry, MerchantSku, Warehouse } = require('../../models');
    const { Op } = require('sequelize');
    console.log(skuName, movementType);

    const where = { company_id: user.companyId };
    if (merchantSkuId) where.merchant_sku_id = merchantSkuId;
    if (warehouseId) {
        await assertWarehousePermission(user, warehouseId);
        where.warehouse_id = warehouseId;
    } else {
        Object.assign(where, await applyWarehouseScope(user, {}, 'warehouse_id'));
    }
    if (movementType) where.movement_type = movementType;  // direct column filter
    if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at[Op.gte] = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.created_at[Op.lte] = end;
        }
    }

    const merchantSkuWhere = {};
    if (skuName) merchantSkuWhere.sku_name = { [Op.like]: `%${skuName}%` }; // case-insensitive partial match

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await StockLedgerEntry.findAndCountAll({
        where,
        include: [
            {
                model: MerchantSku,
                as: 'merchantSku',
                attributes: ['id', 'sku_name', 'sku_title'],
                where: Object.keys(merchantSkuWhere).length ? merchantSkuWhere : undefined,
                required: Object.keys(merchantSkuWhere).length > 0, // INNER JOIN only when filtering by sku_name
            },
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true, // important for accurate count with associations
    });

    return {
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    };
};

module.exports = {
    recomputeCombineSku,
    getStockByMerchantSku,
    getStockByCombineSku,
    getBulkStock,
    manualAdjustStock,
    deductStock,
    packReservedStock,
    getStockLedger,
};
