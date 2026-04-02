'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:merchant_skus${suffix ? ':' + suffix : ''}`;

// ─── Get all warehouses dropdown for filter ───────────────────────────────────
const getWarehouseDropdown = async (user) => {
    const { Warehouse } = require('../../models');
    const warehouses = await Warehouse.findAll({
        where: { company_id: user.companyId, status: 'active' },
        attributes: ['id', 'name', 'code', 'is_default'],
        order: [['is_default', 'DESC'], ['name', 'ASC']],
    });
    return warehouses;
};

// ─── Get Product List (Merchant SKUs) ────────────────────────────────────────
const getMerchantSkus = async (user, filters = {}) => {
    const { MerchantSku, Warehouse } = require('../../models');

    const {
        page = 1, limit = 20,
        search, warehouseId, status,
        country, sortBy = 'created_at', sortOrder = 'DESC',
    } = filters;

    const where = {
        company_id: user.companyId,
        deleted_at: null,
    };

    // Filter by warehouse dropdown
    if (warehouseId && warehouseId !== 'all') {
        where.warehouse_id = warehouseId;
    }

    // Status filter: all | active | inactive | in_stock | out_of_stock
    // in_stock / out_of_stock will be handled via inventory join (currently via status)
    if (status && status !== 'all') {
        if (status === 'in_stock') where.status = 'active';
        else if (status === 'out_of_stock') where.status = 'inactive';
        else where.status = status;
    }

    if (country && country !== 'all') {
        where.country = country;
    }

    // Search: SKU name or title
    if (search) {
        where[Op.or] = [
            { sku_name: { [Op.like]: `%${search}%` } },
            { sku_title: { [Op.like]: `%${search}%` } },
        ];
    }

    const validSortFields = {
        created_at: 'created_at',
        updated_at: 'updated_at',
        sku_name: 'sku_name',
        sku_title: 'sku_title',
    };
    const orderField = validSortFields[sortBy] || 'created_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        include: [{
            model: Warehouse,
            as: 'warehouse',
            attributes: ['id', 'name', 'code'],
            required: false,
        }],
        order: [[orderField, orderDir]],
        limit: parseInt(limit),
        offset,
    });

    // Append inventory counts (available + in-transit)
    // Until Inventory model is built, returns 0
    const data = rows.map(sku => ({
        ...sku.toJSON(),
        available_in_inventory: 0,  // TODO: real count from inventory table
        in_transit_inventory: 0,  // TODO: real count from inbound_order_items
    }));

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

// ─── Get Single Merchant SKU ──────────────────────────────────────────────────
const getMerchantSkuById = async (user, skuId) => {
    const { MerchantSku, Warehouse } = require('../../models');

    const sku = await MerchantSku.findOne({
        where: { id: skuId, company_id: user.companyId, deleted_at: null },
        include: [{ model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'] }],
    });

    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    return sku;
};

// ─── Create Merchant SKU ──────────────────────────────────────────────────────
const createMerchantSku = async (user, data) => {
    const { MerchantSku, Warehouse } = require('../../models');

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

    // Validate warehouse belongs to company
    if (warehouseId) {
        const wh = await Warehouse.findOne({
            where: { id: warehouseId, company_id: user.companyId },
        });
        if (!wh) {
            const err = new Error('Invalid warehouse');
            err.statusCode = 400;
            throw err;
        }
    }

    let imageUrl = null;
    if (image) imageUrl = `data:image/jpeg;base64,${image}`;

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
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return sku;
};

// ─── Update Merchant SKU ──────────────────────────────────────────────────────
const updateMerchantSku = async (user, skuId, data) => {
    const { MerchantSku } = require('../../models');

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

    await sku.update(updates);
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return sku.reload();
};

// ─── Delete Merchant SKU (soft delete) ───────────────────────────────────────
const deleteMerchantSku = async (user, skuId) => {
    const { MerchantSku, CombineSkuItem } = require('../../models');

    const sku = await MerchantSku.findOne({
        where: { id: skuId, company_id: user.companyId, deleted_at: null },
    });

    if (!sku) {
        const err = new Error('Merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    // Cannot delete if used in a combine SKU
    const usedInCombine = await CombineSkuItem.count({
        where: { merchant_sku_id: skuId, company_id: user.companyId },
    });
    if (usedInCombine > 0) {
        const err = new Error(`Cannot delete. This SKU is used in ${usedInCombine} Combine SKU(s). Remove it from those first.`);
        err.statusCode = 400;
        throw err;
    }

    await sku.destroy(); // soft delete via paranoid
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

// ─── Bulk Delete ──────────────────────────────────────────────────────────────
const bulkDeleteMerchantSkus = async (user, skuIds) => {
    const { MerchantSku, CombineSkuItem } = require('../../models');

    if (!Array.isArray(skuIds) || skuIds.length === 0) {
        const err = new Error('skuIds array is required');
        err.statusCode = 400;
        throw err;
    }

    // Check all belong to company
    const skus = await MerchantSku.findAll({
        where: { id: { [Op.in]: skuIds }, company_id: user.companyId, deleted_at: null },
    });

    if (skus.length !== skuIds.length) {
        const err = new Error('One or more SKUs not found');
        err.statusCode = 404;
        throw err;
    }

    // Check none used in combine SKUs
    const usedCount = await CombineSkuItem.count({
        where: { merchant_sku_id: { [Op.in]: skuIds }, company_id: user.companyId },
    });
    if (usedCount > 0) {
        const err = new Error(`${usedCount} SKU(s) are used in Combine SKUs. Remove them first.`);
        err.statusCode = 400;
        throw err;
    }

    await MerchantSku.destroy({
        where: { id: { [Op.in]: skuIds }, company_id: user.companyId },
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return { deleted: skuIds.length };
};

// ─── Get Countries Dropdown ───────────────────────────────────────────────────
const getCountryDropdown = async (user) => {
    const { MerchantSku } = require('../../models');
    const results = await MerchantSku.findAll({
        where: { company_id: user.companyId, deleted_at: null, country: { [Op.ne]: null } },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('country')), 'country']],
        raw: true,
    });
    return results.map(r => r.country).filter(Boolean);
};

module.exports = {
    getWarehouseDropdown,
    getMerchantSkus,
    getMerchantSkuById,
    createMerchantSku,
    updateMerchantSku,
    deleteMerchantSku,
    bulkDeleteMerchantSkus,
    getCountryDropdown,
};