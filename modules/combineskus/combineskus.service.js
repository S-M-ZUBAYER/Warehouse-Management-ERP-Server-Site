'use strict';

/**
 * combineskus.service.js  (UPDATED)
 *
 * Changes from original:
 *  1. createCombineSku — after creating items, immediately runs initial
 *     computed_quantity calculation (MIN logic) so the response is correct.
 *  2. updateCombineSku — re-runs computed_quantity after items change.
 *  3. getCombineSkus / getCombineSkuById — attaches computed_quantity
 *     and child stock availability to the response.
 *  4. getMerchantSkusForPicker — now returns real available_in_inventory
 *     from SkuWarehouseStock.
 *  5. Everything else is identical to your original.
 */

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:combine_skus${suffix ? ':' + suffix : ''}`;

// ─── Helper: recompute a single combine SKU's computed_quantity ───────────────
// Inline version (used directly after create/update, inside or outside a transaction)
const _recompute = async (companyId, combineSkuId, t = null) => {
    const { CombineSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');

    const items = await CombineSkuItem.findAll({
        where: { combine_sku_id: combineSkuId, company_id: companyId },
        attributes: ['merchant_sku_id', 'quantity'],
        raw: true,
        ...(t ? { transaction: t } : {}),
    });

    if (!items.length) return 0;

    const floorValues = await Promise.all(items.map(async (item) => {
        const result = await SkuWarehouseStock.findOne({
            where: { merchant_sku_id: item.merchant_sku_id, company_id: companyId },
            attributes: [[sequelize.fn('SUM', sequelize.col('qty_on_hand')), 'total']],
            raw: true,
            ...(t ? { transaction: t } : {}),
        });
        const total = parseInt(result?.total || 0, 10);
        return Math.floor(total / item.quantity);
    }));

    const computedQty = Math.max(0, Math.min(...floorValues));

    await CombineSku.update(
        { computed_quantity: computedQty },
        { where: { id: combineSkuId, company_id: companyId }, ...(t ? { transaction: t } : {}) }
    );

    return computedQty;
};

// ─── List Combine SKUs ─────────────────────────────────────────────────────────
const getCombineSkus = async (user, filters = {}) => {
    const { CombineSku, CombineSkuItem, MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const {
        page = 1, limit = 20,
        search, warehouseId, status,
        sortBy = 'created_at', sortOrder = 'DESC',
    } = filters;

    const where = { company_id: user.companyId, deleted_at: null };
    if (warehouseId && warehouseId !== 'all') where.warehouse_id = warehouseId;
    if (status && status !== 'all') where.status = status;
    if (search) {
        where[Op.or] = [
            { combine_name: { [Op.like]: `%${search}%` } },
            { combine_sku_code: { [Op.like]: `%${search}%` } },
        ];
    }

    const validSort = { created_at: 'created_at', updated_at: 'updated_at', combine_name: 'combine_name' };
    const orderField = validSort[sortBy] || 'created_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await CombineSku.findAndCountAll({
        where,
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
            {
                model: CombineSkuItem, as: 'items',
                include: [{
                    model: MerchantSku, as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'status'],
                    include: [{
                        model: SkuWarehouseStock, as: 'stock',
                        attributes: ['qty_on_hand', 'qty_reserved', 'qty_inbound'],
                        required: false,
                    }],
                }],
            },
        ],
        order: [[orderField, orderDir]],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    return {
        data: rows,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
};

// ─── Get Single Combine SKU ────────────────────────────────────────────────────
const getCombineSkuById = async (user, combineSkuId) => {
    const { CombineSku, CombineSkuItem, MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: user.companyId, deleted_at: null },
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
            {
                model: CombineSkuItem, as: 'items',
                include: [{
                    model: MerchantSku, as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'status', 'price'],
                    include: [{
                        model: SkuWarehouseStock, as: 'stock',
                        attributes: ['warehouse_id', 'qty_on_hand', 'qty_reserved', 'qty_inbound'],
                        required: false,
                    }],
                }],
            },
        ],
    });

    if (!combineSku) {
        const err = new Error('Combine SKU not found');
        err.statusCode = 404;
        throw err;
    }

    return combineSku;
};

// ─── SKU picker (real stock) ───────────────────────────────────────────────────
const getMerchantSkusForPicker = async (user, { search, warehouseId, page = 1, limit = 20 }) => {
    const { MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const where = { company_id: user.companyId, status: 'active', deleted_at: null };
    if (search) {
        where[Op.or] = [
            { sku_name: { [Op.like]: `%${search}%` } },
            { sku_title: { [Op.like]: `%${search}%` } },
        ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'price', 'status'],
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'], required: false },
            {
                model: SkuWarehouseStock, as: 'stock',
                attributes: ['qty_on_hand', 'qty_reserved'],
                required: false,
                // If warehouseId filter passed, only show stock for that warehouse
                where: warehouseId ? { warehouse_id: warehouseId } : undefined,
            },
        ],
        order: [['sku_name', 'ASC']],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    const data = rows.map(sku => {
        const stockRows = Array.isArray(sku.stock) ? sku.stock : (sku.stock ? [sku.stock] : []);
        const totals = stockRows.reduce((acc, s) => ({
            on_hand: acc.on_hand + (s?.qty_on_hand || 0),
            reserved: acc.reserved + (s?.qty_reserved || 0),
        }), { on_hand: 0, reserved: 0 });
        return {
            ...sku.toJSON(),
            available_in_inventory: Math.max(0, totals.on_hand - totals.reserved),
        };
    });

    return {
        data,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
};

// ─── Create Combine SKU — with initial computed_quantity ──────────────────────
const createCombineSku = async (user, data) => {
    const { CombineSku, CombineSkuItem, MerchantSku, Warehouse } = require('../../models');

    const {
        combineName, combineSkuCode, gtin, description,
        sellingPrice, costPrice, weight, length, width, height,
        warehouseId, status, items,
    } = data;

    // Unique code check
    const existing = await CombineSku.findOne({
        where: { company_id: user.companyId, combine_sku_code: combineSkuCode.trim().toUpperCase() },
    });
    if (existing) {
        const err = new Error('Combine SKU code already exists');
        err.statusCode = 409;
        throw err;
    }

    // Validate all merchant SKU IDs belong to company
    const merchantSkuIds = items.map(i => i.merchantSkuId);
    const validSkus = await MerchantSku.count({
        where: { id: { [Op.in]: merchantSkuIds }, company_id: user.companyId, deleted_at: null },
    });
    if (validSkus !== merchantSkuIds.length) {
        const err = new Error('One or more merchant SKUs are invalid');
        err.statusCode = 400;
        throw err;
    }

    // Validate warehouse
    if (warehouseId) {
        const wh = await Warehouse.findOne({ where: { id: warehouseId, company_id: user.companyId } });
        if (!wh) {
            const err = new Error('Invalid warehouse');
            err.statusCode = 400;
            throw err;
        }
    }

    const result = await sequelize.transaction(async (t) => {
        const combineSku = await CombineSku.create({
            company_id: user.companyId,
            warehouse_id: warehouseId || null,
            combine_name: combineName.trim(),
            combine_sku_code: combineSkuCode.trim().toUpperCase(),
            gtin: gtin || null,
            description: description || null,
            selling_price: sellingPrice || null,
            cost_price: costPrice || null,
            weight: weight || null,
            length: length || null,
            width: width || null,
            height: height || null,
            status: status || 'active',
            computed_quantity: 0, // will be set below
            created_by: user.userId,
        }, { transaction: t });

        await CombineSkuItem.bulkCreate(
            items.map(item => ({
                company_id: user.companyId,
                combine_sku_id: combineSku.id,
                merchant_sku_id: item.merchantSkuId,
                quantity: item.quantity,
            })),
            { transaction: t }
        );

        // Compute initial quantity (runs inside transaction so stock reads are consistent)
        await _recompute(user.companyId, combineSku.id, t);

        return combineSku;
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getCombineSkuById(user, result.id);
};

// ─── Update Combine SKU — re-runs computed_quantity if items changed ──────────
const updateCombineSku = async (user, combineSkuId, data) => {
    const { CombineSku, CombineSkuItem, MerchantSku } = require('../../models');

    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: user.companyId, deleted_at: null },
    });
    if (!combineSku) {
        const err = new Error('Combine SKU not found');
        err.statusCode = 404;
        throw err;
    }

    const itemsChanged = data.items && data.items.length > 0;

    await sequelize.transaction(async (t) => {
        const updates = {};
        if (data.combineName !== undefined) updates.combine_name = data.combineName.trim();
        if (data.gtin !== undefined) updates.gtin = data.gtin;
        if (data.description !== undefined) updates.description = data.description;
        if (data.sellingPrice !== undefined) updates.selling_price = data.sellingPrice;
        if (data.costPrice !== undefined) updates.cost_price = data.costPrice;
        if (data.weight !== undefined) updates.weight = data.weight;
        if (data.length !== undefined) updates.length = data.length;
        if (data.width !== undefined) updates.width = data.width;
        if (data.height !== undefined) updates.height = data.height;
        if (data.warehouseId !== undefined) updates.warehouse_id = data.warehouseId;
        if (data.status !== undefined) updates.status = data.status;

        if (Object.keys(updates).length > 0) await combineSku.update(updates, { transaction: t });

        if (itemsChanged) {
            const merchantSkuIds = data.items.map(i => i.merchantSkuId);
            const validSkus = await MerchantSku.count({
                where: { id: { [Op.in]: merchantSkuIds }, company_id: user.companyId, deleted_at: null },
            });
            if (validSkus !== merchantSkuIds.length) {
                const err = new Error('One or more merchant SKUs are invalid');
                err.statusCode = 400;
                throw err;
            }

            // Replace all items atomically
            await CombineSkuItem.destroy({
                where: { combine_sku_id: combineSkuId, company_id: user.companyId },
                transaction: t,
            });

            await CombineSkuItem.bulkCreate(
                data.items.map(item => ({
                    company_id: user.companyId,
                    combine_sku_id: combineSkuId,
                    merchant_sku_id: item.merchantSkuId,
                    quantity: item.quantity,
                })),
                { transaction: t }
            );
        }

        // Always re-run computed_quantity (items may have changed or stock may differ)
        await _recompute(user.companyId, combineSkuId, t);
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getCombineSkuById(user, combineSkuId);
};

// ─── Delete (soft) — unchanged from original ──────────────────────────────────
const deleteCombineSku = async (user, combineSkuId) => {
    const { CombineSku } = require('../../models');

    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: user.companyId, deleted_at: null },
    });
    if (!combineSku) {
        const err = new Error('Combine SKU not found');
        err.statusCode = 404;
        throw err;
    }

    await combineSku.destroy();
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

module.exports = {
    getCombineSkus,
    getCombineSkuById,
    getMerchantSkusForPicker,
    createCombineSku,
    updateCombineSku,
    deleteCombineSku,
};
