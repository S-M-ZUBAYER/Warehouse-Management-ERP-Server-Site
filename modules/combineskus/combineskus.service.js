'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:combine_skus${suffix ? ':' + suffix : ''}`;

// ─── Get all Combine SKUs ─────────────────────────────────────────────────────
const getCombineSkus = async (user, filters = {}) => {
    const { CombineSku, CombineSkuItem, MerchantSku, Warehouse } = require('../../models');

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
            {
                model: Warehouse,
                as: 'warehouse',
                attributes: ['id', 'name', 'code'],
                required: false,
            },
            {
                model: CombineSkuItem,
                as: 'items',
                include: [{
                    model: MerchantSku,
                    as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'status'],
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

// ─── Get Single Combine SKU ───────────────────────────────────────────────────
const getCombineSkuById = async (user, combineSkuId) => {
    const { CombineSku, CombineSkuItem, MerchantSku, Warehouse } = require('../../models');

    const combineSku = await CombineSku.findOne({
        where: { id: combineSkuId, company_id: user.companyId, deleted_at: null },
        include: [
            {
                model: Warehouse,
                as: 'warehouse',
                attributes: ['id', 'name', 'code'],
                required: false,
            },
            {
                model: CombineSkuItem,
                as: 'items',
                include: [{
                    model: MerchantSku,
                    as: 'merchantSku',
                    attributes: ['id', 'sku_name', 'sku_title', 'image_url', 'status', 'price'],
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

// ─── Get Merchant SKUs for the picker (Add Combine SKU screen) ────────────────
// Returns searchable list of merchant SKUs for the left panel in the UI
const getMerchantSkusForPicker = async (user, { search, page = 1, limit = 20 }) => {
    const { MerchantSku, Warehouse } = require('../../models');

    const where = {
        company_id: user.companyId,
        status: 'active',
        deleted_at: null,
    };

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
        include: [{
            model: Warehouse,
            as: 'warehouse',
            attributes: ['id', 'name'],
            required: false,
        }],
        order: [['sku_name', 'ASC']],
        limit: parseInt(limit),
        offset,
    });

    // Append inventory available count (returns 0 until Inventory module built)
    const data = rows.map(sku => ({
        ...sku.toJSON(),
        available_in_inventory: 0,
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

// ─── Create Combine SKU ───────────────────────────────────────────────────────
const createCombineSku = async (user, data) => {
    const { CombineSku, CombineSkuItem, MerchantSku, Warehouse } = require('../../models');

    const {
        combineName, combineSkuCode, gtin, description,
        sellingPrice, costPrice, weight, length, width, height,
        warehouseId, status, items,
    } = data;

    // Check code unique within company
    const existing = await CombineSku.findOne({
        where: { company_id: user.companyId, combine_sku_code: combineSkuCode.trim().toUpperCase() },
    });
    if (existing) {
        const err = new Error('Combine SKU code already exists');
        err.statusCode = 409;
        throw err;
    }

    // Validate all merchant SKU IDs belong to this company
    const merchantSkuIds = items.map(i => i.merchantSkuId);
    const validSkus = await MerchantSku.count({
        where: {
            id: { [Op.in]: merchantSkuIds },
            company_id: user.companyId,
            deleted_at: null,
        },
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
            created_by: user.userId,
        }, { transaction: t });

        // Create junction items
        await CombineSkuItem.bulkCreate(
            items.map(item => ({
                company_id: user.companyId,
                combine_sku_id: combineSku.id,
                merchant_sku_id: item.merchantSkuId,
                quantity: item.quantity,
            })),
            { transaction: t }
        );

        return combineSku;
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getCombineSkuById(user, result.id);
};

// ─── Update Combine SKU ───────────────────────────────────────────────────────
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

        if (Object.keys(updates).length > 0) {
            await combineSku.update(updates, { transaction: t });
        }

        // Replace items if provided
        if (data.items && data.items.length > 0) {
            const merchantSkuIds = data.items.map(i => i.merchantSkuId);
            const validSkus = await MerchantSku.count({
                where: { id: { [Op.in]: merchantSkuIds }, company_id: user.companyId, deleted_at: null },
            });
            if (validSkus !== merchantSkuIds.length) {
                const err = new Error('One or more merchant SKUs are invalid');
                err.statusCode = 400;
                throw err;
            }

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
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));
    return getCombineSkuById(user, combineSkuId);
};

// ─── Delete Combine SKU (soft delete) ────────────────────────────────────────
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

    await combineSku.destroy(); // paranoid soft delete
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