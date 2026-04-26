'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

// ─── Recompute a single combined SKU's computed_quantity ──────────────────────
// Formula: MIN( FLOOR(qty_on_hand / item.quantity) ) across all child SKUs
// Called directly by the worker AND can be called inline for small operations
const recomputeCombineSku = async (companyId, combineSkuId, t = null) => {
    const { CombineSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');

    const items = await CombineSkuItem.findAll({
        where: { combine_sku_id: combineSkuId, company_id: companyId },
        attributes: ['merchant_sku_id', 'quantity'],
        raw: true,
        ...(t ? { transaction: t } : {}),
    });

    if (!items.length) return 0;

    // For each child SKU, find the max qty_on_hand across all its warehouse stock records
    // (a merchant SKU can exist in multiple warehouses — use the total)
    const qtyPerSku = await Promise.all(items.map(async (item) => {
        const result = await SkuWarehouseStock.findOne({
            where: { merchant_sku_id: item.merchant_sku_id, company_id: companyId },
            attributes: [[sequelize.fn('SUM', sequelize.col('qty_on_hand')), 'total_qty']],
            raw: true,
            ...(t ? { transaction: t } : {}),
        });
        const totalQty = parseInt(result?.total_qty || 0, 10);
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
    });

    // Queue combine SKU recompute
    const combineItems = await CombineSkuItem.findAll({
        where: { merchant_sku_id: merchantSkuId, company_id: user.companyId },
        attributes: ['combine_sku_id'],
        raw: true,
    });
    if (combineItems.length) {
        const ids = [...new Set(combineItems.map(i => i.combine_sku_id))];
        // const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
        // ids.forEach(id =>
        //     pipeline.rpush('queue:combine_sku_recompute', JSON.stringify({ companyId: user.companyId, combineSkuId: id }))
        // );
        // await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
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

// ─── Stock deduct (called by Java after platform sale webhook) ────────────────
// This is the most critical endpoint — must be idempotent and atomic
const deductStock = async (user, data) => {
    const {
        PlatformSkuMapping, OrderSaleLine, CombineSkuItem,
        SkuWarehouseStock, StockLedgerEntry, CombineSku,
    } = require('../../models');

    const { platformMappingId, platformOrderId, platformOrderItemId, quantitySold } = data;

    // 1. Resolve mapping
    const mapping = await PlatformSkuMapping.findOne({
        where: { id: platformMappingId, company_id: user.companyId, is_active: true, deleted_at: null },
        include: [{ model: require('../../models').PlatformStore, as: 'platformStore', attributes: ['id', 'platform'] }],
    });
    if (!mapping) {
        const err = new Error('Platform SKU mapping not found or inactive');
        err.statusCode = 404;
        throw err;
    }

    // 2. Idempotency check — already processed?
    const existing = await OrderSaleLine.findOne({
        where: {
            platform_sku_mapping_id: platformMappingId,
            platform_order_id: platformOrderId,
            platform_order_item_id: platformOrderItemId || null,
            deducted: true,
        },
    });
    if (existing) {
        return { alreadyDeducted: true, saleLineId: existing.id };
    }

    const warehouseId = mapping.fulfillment_warehouse_id;
    const deductions = [];
    const affectedSkus = [];

    await sequelize.transaction(async (t) => {
        if (mapping.merchant_sku_id) {
            // ── Direct merchant SKU deduction ────────────────────────────────
            const stockRecord = await SkuWarehouseStock.findOne({
                where: { merchant_sku_id: mapping.merchant_sku_id, warehouse_id: warehouseId },
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!stockRecord) {
                const err = new Error(`No stock record for merchant SKU ${mapping.merchant_sku_id} in warehouse ${warehouseId}`);
                err.statusCode = 400;
                throw err;
            }

            const newQtyOnHand = (stockRecord.qty_on_hand || 0) - quantitySold;
            if (newQtyOnHand < 0) {
                const err = new Error(`Insufficient stock: available ${stockRecord.qty_on_hand}, requested ${quantitySold}`);
                err.statusCode = 400;
                throw err;
            }

            await stockRecord.update({ qty_on_hand: newQtyOnHand }, { transaction: t });

            await StockLedgerEntry.create({
                company_id: user.companyId,
                merchant_sku_id: mapping.merchant_sku_id,
                warehouse_id: warehouseId,
                sku_warehouse_stock_id: stockRecord.id,
                movement_type: 'sale_deduction',
                quantity_delta: -quantitySold,
                qty_on_hand_after: newQtyOnHand,
                reference_type: 'platform_order',
                reference_id: platformOrderId,
                notes: `Sold on ${mapping.platformStore?.platform || 'platform'} — order ${platformOrderId}`,
                created_by: user.userId,
            }, { transaction: t });

            deductions.push({ merchantSkuId: mapping.merchant_sku_id, newQtyOnHand });
            affectedSkus.push(mapping.merchant_sku_id);

        } else if (mapping.combine_sku_id) {
            // ── Combined SKU — deduct each child SKU proportionally ──────────
            const items = await CombineSkuItem.findAll({
                where: { combine_sku_id: mapping.combine_sku_id, company_id: user.companyId },
                attributes: ['merchant_sku_id', 'quantity'],
                transaction: t,
            });

            for (const item of items) {
                const deductQty = item.quantity * quantitySold;

                const stockRecord = await SkuWarehouseStock.findOne({
                    where: { merchant_sku_id: item.merchant_sku_id, warehouse_id: warehouseId },
                    lock: t.LOCK.UPDATE,
                    transaction: t,
                });
                if (!stockRecord) {
                    const err = new Error(`No stock record for child SKU ${item.merchant_sku_id}`);
                    err.statusCode = 400;
                    throw err;
                }

                const newQtyOnHand = (stockRecord.qty_on_hand || 0) - deductQty;
                if (newQtyOnHand < 0) {
                    const err = new Error(`Insufficient stock for child SKU ${item.merchant_sku_id}: available ${stockRecord.qty_on_hand}, needed ${deductQty}`);
                    err.statusCode = 400;
                    throw err;
                }

                await stockRecord.update({ qty_on_hand: newQtyOnHand }, { transaction: t });

                await StockLedgerEntry.create({
                    company_id: user.companyId,
                    merchant_sku_id: item.merchant_sku_id,
                    warehouse_id: warehouseId,
                    sku_warehouse_stock_id: stockRecord.id,
                    movement_type: 'sale_deduction',
                    quantity_delta: -deductQty,
                    qty_on_hand_after: newQtyOnHand,
                    reference_type: 'platform_order',
                    reference_id: platformOrderId,
                    notes: `Part of combine SKU ${mapping.combine_sku_id} — sold ${quantitySold} units × ratio ${item.quantity}`,
                    created_by: user.userId,
                }, { transaction: t });

                deductions.push({ merchantSkuId: item.merchant_sku_id, deductQty, newQtyOnHand });
                affectedSkus.push(item.merchant_sku_id);
            }
        }

        // 3. Record the sale line (idempotency marker)
        await OrderSaleLine.create({
            company_id: user.companyId,
            platform_sku_mapping_id: platformMappingId,
            platform_order_id: platformOrderId,
            platform_order_item_id: platformOrderItemId || null,
            quantity_sold: quantitySold,
            deducted: true,
            deducted_at: new Date(),
            sold_at: new Date(),
        }, { transaction: t });
    });

    // 4. Queue combine SKU recompute after commit
    if (affectedSkus.length && mapping.combine_sku_id) {
        // const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
        // pipeline.rpush('queue:combine_sku_recompute', JSON.stringify({
        //     companyId: user.companyId,
        //     combineSkuId: mapping.combine_sku_id,
        // }));
        // await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
        const pipeline = redis.client.multi();
        pipeline.rPush('queue:combine_sku_recompute', JSON.stringify({
            companyId: user.companyId,
            combineSkuId: mapping.combine_sku_id,
        }));
        await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
    } else if (affectedSkus.length) {
        // Check if deducted merchant SKU is part of any combine SKU
        const { CombineSkuItem: CSI } = require('../../models');
        const linkedCombines = await CSI.findAll({
            where: { merchant_sku_id: { [Op.in]: affectedSkus }, company_id: user.companyId },
            attributes: ['combine_sku_id'],
            group: ['combine_sku_id'],
            raw: true,
        });
        if (linkedCombines.length) {
            // const pipeline = redis.client.pipeline ? redis.client.pipeline() : redis.client.multi();
            // linkedCombines.forEach(({ combine_sku_id }) =>
            //     pipeline.rpush('queue:combine_sku_recompute', JSON.stringify({ companyId: user.companyId, combineSkuId: combine_sku_id }))
            // );
            // await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
            const pipeline = redis.client.multi();
            linkedCombines.forEach(({ combine_sku_id }) =>
                pipeline.rPush('queue:combine_sku_recompute', JSON.stringify({ companyId: user.companyId, combineSkuId: combine_sku_id }))
            );
            await pipeline.exec().catch(e => console.error('[redis queue]', e.message));
        }
    }

    return {
        alreadyDeducted: false,
        platformOrderId,
        deductions,
        combineSkuId: mapping.combine_sku_id || null,
    };
};

// ─── Get ledger / history for a SKU ──────────────────────────────────────────
// const getStockLedger = async (user, { merchantSkuId, warehouseId, page = 1, limit = 30 }) => {
//     const { StockLedgerEntry, MerchantSku, Warehouse } = require('../../models');

//     const where = { company_id: user.companyId };
//     if (merchantSkuId) where.merchant_sku_id = merchantSkuId;
//     if (warehouseId) where.warehouse_id = warehouseId;

//     const offset = (parseInt(page) - 1) * parseInt(limit);

//     const { count, rows } = await StockLedgerEntry.findAndCountAll({
//         where,
//         include: [
//             { model: MerchantSku, as: 'merchantSku', attributes: ['id', 'sku_name', 'sku_title'], required: false },
//         ],
//         order: [['created_at', 'DESC']],
//         limit: parseInt(limit),
//         offset,
//     });

//     return {
//         data: rows,
//         pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
//     };
// };

const getStockLedger = async (user, { merchantSkuId, warehouseId, skuName, movementType, page = 1, limit = 30 }) => {
    const { StockLedgerEntry, MerchantSku, Warehouse } = require('../../models');
    const { Op } = require('sequelize');
    console.log(skuName, movementType);

    const where = { company_id: user.companyId };
    if (merchantSkuId) where.merchant_sku_id = merchantSkuId;
    if (warehouseId) where.warehouse_id = warehouseId;
    if (movementType) where.movement_type = movementType;  // direct column filter

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
    getStockLedger,
};