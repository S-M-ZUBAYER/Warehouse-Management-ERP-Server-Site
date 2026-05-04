'use strict';

/**
 * merchantSkus.service.js  (UPDATED)
 *
 * Changes from original:
 *  1. getMerchantSkus / getMerchantSkuById — joins SkuWarehouseStock to return
 *     real available_in_inventory / in_transit_inventory counts.
 *  2. createMerchantSku — auto-creates a SkuWarehouseStock row (qty=0) if warehouseId is set.
 *  3. deleteMerchantSku / bulkDeleteMerchantSkus — also blocks delete if stock > 0.
 *  4. Everything else is identical to your original.
 */

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:merchant_skus${suffix ? ':' + suffix : ''}`;

// ─── Dropdown helpers (unchanged) ─────────────────────────────────────────────
const getWarehouseDropdown = async (user) => {
    const { Warehouse } = require('../../models');
    return Warehouse.findAll({
        where: { company_id: user.companyId, status: 'active' },
        attributes: ['id', 'name', 'code', 'is_default'],
        order: [['is_default', 'DESC'], ['name', 'ASC']],
    });
};

const getCountryDropdown = async (user) => {
    const { MerchantSku } = require('../../models');
    const results = await MerchantSku.findAll({
        where: { company_id: user.companyId, deleted_at: null, country: { [Op.ne]: null } },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('country')), 'country']],
        raw: true,
    });
    return results.map(r => r.country).filter(Boolean);
};

// ─── List Merchant SKUs — with real stock counts ──────────────────────────────
const getMerchantSkus = async (user, filters = {}) => {
    const { MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const {
        page = 1, limit = 20,
        search, warehouseId, status,
        country, sortBy = 'created_at', sortOrder = 'DESC',
    } = filters;

    const where = { company_id: user.companyId, deleted_at: null };

    if (warehouseId && warehouseId !== 'all') where.warehouse_id = warehouseId;

    if (status && status !== 'all') {
        if (status === 'in_stock') { /* handled in post-filter below */ }
        else if (status === 'out_of_stock') { /* handled below */ }
        else where.status = status;
    }

    if (country && country !== 'all') where.country = country;

    if (search) {
        where[Op.or] = [
            { sku_name: { [Op.like]: `%${search}%` } },
            { sku_title: { [Op.like]: `%${search}%` } },
        ];
    }

    const validSortFields = {
        created_at: 'created_at', updated_at: 'updated_at',
        sku_name: 'sku_name', sku_title: 'sku_title',
    };
    const orderField = validSortFields[sortBy] || 'created_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        include: [
            {
                model: Warehouse,
                as: 'warehouse',
                attributes: ['id', 'name', 'code'],
                required: false,
            },
            {
                // Pull stock for the SKU's assigned warehouse (or all warehouses if no filter)
                model: SkuWarehouseStock,
                as: 'stock',
                attributes: ['qty_on_hand', 'qty_reserved', 'qty_inbound', 'warehouse_id'],
                required: false,
                where: warehouseId && warehouseId !== 'all'
                    ? { warehouse_id: warehouseId }
                    : undefined,
            },
        ],
        order: [[orderField, orderDir]],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    let data = rows.map(sku => {
        const stockRows = sku.stock || [];
        const stockArray = Array.isArray(stockRows) ? stockRows : [stockRows];
        const totals = stockArray.reduce((acc, s) => ({
            on_hand: acc.on_hand + (s?.qty_on_hand || 0),
            reserved: acc.reserved + (s?.qty_reserved || 0),
            inbound: acc.inbound + (s?.qty_inbound || 0),
        }), { on_hand: 0, reserved: 0, inbound: 0 });

        return {
            ...sku.toJSON(),
            available_in_inventory: Math.max(0, totals.on_hand - totals.reserved),
            in_transit_inventory: totals.inbound,
        };
    });

    // in_stock / out_of_stock post-filter (needs real stock values)
    if (status === 'in_stock') data = data.filter(s => s.available_in_inventory > 0);
    if (status === 'out_of_stock') data = data.filter(s => s.available_in_inventory === 0);

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

// ─── Get Single — with real stock ─────────────────────────────────────────────
const getMerchantSkuById = async (user, skuId) => {
    const { MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const sku = await MerchantSku.findOne({
        where: { id: skuId, company_id: user.companyId, deleted_at: null },
        include: [
            { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
            { model: SkuWarehouseStock, as: 'stock', attributes: ['warehouse_id', 'qty_on_hand', 'qty_reserved', 'qty_inbound'], required: false },
        ],
    });

    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    // Attach aggregated stock totals at the top level for easy consumption
    const stockRows = Array.isArray(sku.stock) ? sku.stock : (sku.stock ? [sku.stock] : []);
    const totals = stockRows.reduce((acc, s) => ({
        qty_on_hand: acc.qty_on_hand + (s.qty_on_hand || 0),
        qty_reserved: acc.qty_reserved + (s.qty_reserved || 0),
        qty_inbound: acc.qty_inbound + (s.qty_inbound || 0),
    }), { qty_on_hand: 0, qty_reserved: 0, qty_inbound: 0 });

    return {
        ...sku.toJSON(),
        available_in_inventory: Math.max(0, totals.qty_on_hand - totals.qty_reserved),
        in_transit_inventory: totals.qty_inbound,
        stock_totals: totals,
    };
};

// ─── Create Merchant SKU — auto-creates SkuWarehouseStock row ────────────────
const createMerchantSku = async (user, data) => {
    const { MerchantSku, Warehouse, SkuWarehouseStock } = require('../../models');

    const {
        skuName, skuTitle, warehouseId, gtin, productDetails,
        weight, length, width, height, price, costPrice,
        country, status, image,
    } = data;


    // Check SKU name unique within company
    const existing = await MerchantSku.findOne({
        where: { company_id: user.companyId, sku_name: skuName.trim().toUpperCase() },
    });
    if (existing) {
        const err = new Error('SKU name already exists in this company');
        err.statusCode = 409;
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

    // let imageUrl = null;
    // if (image) imageUrl = `data:image/jpeg;base64,${image}`;
    let imageUrl = null;
    if (image) {
        // Detect mime type from base64 header
        const mimeMatch = image.match(/^data:(image\/[a-zA-Z]+);base64,/);
        if (mimeMatch) {
            // image already has data URI prefix
            imageUrl = image;
        } else {
            // raw base64, detect from magic bytes
            const mime = image.charAt(0) === '/' ? 'image/jpeg' : 'image/png';
            imageUrl = `data:${mime};base64,${image}`;
        }
    }

    const result = await sequelize.transaction(async (t) => {
        const sku = await MerchantSku.create({
            company_id: user.companyId,
            warehouse_id: warehouseId || null,
            sku_name: skuName.trim().toUpperCase(),
            sku_title: skuTitle.trim(),
            gtin: gtin || null,
            product_details: productDetails || null,
            weight: weight || null,
            length: length || null,
            width: width || null,
            height: height || null,
            price: price || null,
            cost_price: costPrice || null,
            image_url: imageUrl,
            country: country || null,
            status: status || 'active',
            created_by: user.userId,
        }, { transaction: t });

        // Auto-create stock record with zero quantities
        if (warehouseId) {
            await SkuWarehouseStock.create({
                company_id: user.companyId,
                merchant_sku_id: sku.id,
                warehouse_id: warehouseId,
                qty_on_hand: 0,
                qty_reserved: 0,
                qty_inbound: 0,
            }, { transaction: t });
        }

        return sku;
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getMerchantSkuById(user, result.id);
};

// ─── Update Merchant SKU (unchanged logic, returns with real stock) ───────────
const updateMerchantSku = async (user, skuId, data) => {
    const { MerchantSku, SkuWarehouseStock } = require('../../models');

    const sku = await MerchantSku.findOne({
        where: { id: skuId, company_id: user.companyId, deleted_at: null },
    });
    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    const updates = {};
    if (data.skuTitle !== undefined) updates.sku_title = data.skuTitle.trim();
    if (data.warehouseId !== undefined) updates.warehouse_id = data.warehouseId;
    if (data.gtin !== undefined) updates.gtin = data.gtin;
    if (data.productDetails !== undefined) updates.product_details = data.productDetails;
    if (data.weight !== undefined) updates.weight = data.weight;
    if (data.length !== undefined) updates.length = data.length;
    if (data.width !== undefined) updates.width = data.width;
    if (data.height !== undefined) updates.height = data.height;
    if (data.price !== undefined) updates.price = data.price;
    if (data.costPrice !== undefined) updates.cost_price = data.costPrice;
    if (data.country !== undefined) updates.country = data.country;
    if (data.status !== undefined) updates.status = data.status;
    if (data.image !== undefined) updates.image_url = `data:image/jpeg;base64,${data.image}`;

    // If warehouse changed and no stock record exists yet for new warehouse — create one
    if (data.warehouseId && data.warehouseId !== sku.warehouse_id) {
        await sequelize.transaction(async (t) => {
            await sku.update(updates, { transaction: t });
            const [, created] = await SkuWarehouseStock.findOrCreate({
                where: { merchant_sku_id: skuId, warehouse_id: data.warehouseId },
                defaults: { company_id: user.companyId, qty_on_hand: 0, qty_reserved: 0, qty_inbound: 0 },
                transaction: t,
            });
        });
    } else {
        await sku.update(updates);
    }

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getMerchantSkuById(user, skuId);
};

// ─── Delete Merchant SKU — blocks if stock > 0 or used in combine SKU ────────
const deleteMerchantSku = async (user, skuId) => {
    const { MerchantSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');

    const sku = await MerchantSku.findOne({
        where: { id: skuId, company_id: user.companyId, deleted_at: null },
    });
    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    // Block if used in combine SKU
    const usedInCombine = await CombineSkuItem.count({
        where: { merchant_sku_id: skuId, company_id: user.companyId },
    });
    if (usedInCombine > 0) {
        const err = new Error(`Cannot delete. This SKU is used in ${usedInCombine} Combine SKU(s). Remove it from those first.`);
        err.statusCode = 400;
        throw err;
    }

    // Block if stock on hand > 0
    const stockRecord = await SkuWarehouseStock.findOne({
        where: { merchant_sku_id: skuId, company_id: user.companyId },
        attributes: [[sequelize.fn('SUM', sequelize.col('qty_on_hand')), 'total']],
        raw: true,
    });
    if (parseInt(stockRecord?.total || 0, 10) > 0) {
        const err = new Error(`Cannot delete. This SKU has ${stockRecord.total} unit(s) in stock. Adjust stock to 0 first.`);
        err.statusCode = 400;
        throw err;
    }

    await sku.destroy(); // paranoid soft delete
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

// ─── Bulk Delete ───────────────────────────────────────────────────────────────
const bulkDeleteMerchantSkus = async (user, skuIds) => {
    const { MerchantSku, CombineSkuItem, SkuWarehouseStock } = require('../../models');

    if (!Array.isArray(skuIds) || skuIds.length === 0) {
        const err = new Error('skuIds array is required');
        err.statusCode = 400;
        throw err;
    }

    const skus = await MerchantSku.findAll({
        where: { id: { [Op.in]: skuIds }, company_id: user.companyId, deleted_at: null },
    });
    if (skus.length !== skuIds.length) {
        const err = new Error('One or more SKUs not found');
        err.statusCode = 404;
        throw err;
    }

    const usedCount = await CombineSkuItem.count({
        where: { merchant_sku_id: { [Op.in]: skuIds }, company_id: user.companyId },
    });
    if (usedCount > 0) {
        const err = new Error(`${usedCount} SKU(s) are used in Combine SKUs. Remove them first.`);
        err.statusCode = 400;
        throw err;
    }

    // Check total stock across all SKUs
    const stockResult = await SkuWarehouseStock.findOne({
        where: { merchant_sku_id: { [Op.in]: skuIds }, company_id: user.companyId },
        attributes: [[sequelize.fn('SUM', sequelize.col('qty_on_hand')), 'total']],
        raw: true,
    });
    if (parseInt(stockResult?.total || 0, 10) > 0) {
        const err = new Error(`One or more SKUs still have stock on hand. Adjust stock to 0 before deleting.`);
        err.statusCode = 400;
        throw err;
    }

    await MerchantSku.destroy({
        where: { id: { [Op.in]: skuIds }, company_id: user.companyId },
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return { deleted: skuIds.length };
};

module.exports = {
    getWarehouseDropdown,
    getCountryDropdown,
    getMerchantSkus,
    getMerchantSkuById,
    createMerchantSku,
    updateMerchantSku,
    deleteMerchantSku,
    bulkDeleteMerchantSkus,
};
