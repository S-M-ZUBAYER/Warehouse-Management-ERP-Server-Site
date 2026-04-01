'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

// Redis cache key helper
const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:warehouses${suffix ? ':' + suffix : ''}`;

// Auto-generate warehouse code e.g. WH-001
const generateWarehouseCode = async (companyId) => {
    const { Warehouse } = require('../../models');
    const count = await Warehouse.count({ where: { company_id: companyId } });
    return `WH-${String(count + 1).padStart(3, '0')}`;
};

// ─── Get All Warehouses ───────────────────────────────────────────────────────
const getWarehouses = async (user, filters = {}) => {
    const { Warehouse } = require('../../models');
    const { page = 1, limit = 20, status, attribute, search } = filters;

    // Try cache for simple unfiltered list
    const key = cacheKey(user.companyId, `p${page}:l${limit}`);
    if (!status && !attribute && !search) {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);
    }

    const where = { company_id: user.companyId };
    if (status) where.status = status;
    if (attribute) where.attribute = attribute;
    if (search) {
        where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { code: { [Op.like]: `%${search}%` } },
            { location: { [Op.like]: `%${search}%` } },
        ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Warehouse.findAndCountAll({
        where,
        order: [
            ['is_default', 'DESC'],   // default warehouse always first
            ['created_at', 'DESC'],
        ],
        limit: parseInt(limit),
        offset,
    });

    // Append total_sku count per warehouse (from inventory table when available)
    // For now returns 0 — will be real count once Inventory model is built
    const data = rows.map(wh => ({
        ...wh.toJSON(),
        total_sku: 0,   // TODO: replace with real inventory count
    }));

    const result = {
        data,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };

    // Cache 2 min for plain list
    if (!status && !attribute && !search) {
        await redis.set(key, JSON.stringify(result), { EX: 120 });
    }

    return result;
};

// ─── Get Single Warehouse ─────────────────────────────────────────────────────
const getWarehouseById = async (user, warehouseId) => {
    const { Warehouse } = require('../../models');

    const warehouse = await Warehouse.findOne({
        where: { id: warehouseId, company_id: user.companyId },
    });

    if (!warehouse) {
        const err = new Error('Warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    return warehouse;
};

// ─── Create Warehouse ─────────────────────────────────────────────────────────
const createWarehouse = async (user, data) => {
    const { Warehouse } = require('../../models');

    const {
        name, attribute, managerName, phone,
        location, city, country, status,
    } = data;

    // Check name unique within company
    const existing = await Warehouse.findOne({
        where: { company_id: user.companyId, name: name.trim() },
    });
    if (existing) {
        const err = new Error('A warehouse with this name already exists');
        err.statusCode = 409;
        throw err;
    }

    const code = await generateWarehouseCode(user.companyId);

    // First warehouse created is automatically set as default
    const warehouseCount = await Warehouse.count({
        where: { company_id: user.companyId },
    });
    const isDefault = warehouseCount === 0;

    const warehouse = await Warehouse.create({
        company_id: user.companyId,
        name: name.trim(),
        code,
        attribute: attribute || 'own_warehouse',
        manager_name: managerName || null,
        phone: phone || null,
        location: location || null,
        city: city || null,
        country: country || null,
        is_default: isDefault,
        status: status || 'active',
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return warehouse;
};

// ─── Update Warehouse ─────────────────────────────────────────────────────────
const updateWarehouse = async (user, warehouseId, data) => {
    const { Warehouse } = require('../../models');

    const warehouse = await Warehouse.findOne({
        where: { id: warehouseId, company_id: user.companyId },
    });

    if (!warehouse) {
        const err = new Error('Warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    // If renaming — check new name not already taken
    if (data.name && data.name.trim() !== warehouse.name) {
        const duplicate = await Warehouse.findOne({
            where: {
                company_id: user.companyId,
                name: data.name.trim(),
                id: { [Op.ne]: warehouseId },
            },
        });
        if (duplicate) {
            const err = new Error('A warehouse with this name already exists');
            err.statusCode = 409;
            throw err;
        }
    }

    const updates = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.attribute !== undefined) updates.attribute = data.attribute;
    if (data.managerName !== undefined) updates.manager_name = data.managerName;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.location !== undefined) updates.location = data.location;
    if (data.city !== undefined) updates.city = data.city;
    if (data.country !== undefined) updates.country = data.country;
    if (data.status !== undefined) updates.status = data.status;

    await warehouse.update(updates);
    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return warehouse;
};

// ─── Delete Warehouse ─────────────────────────────────────────────────────────
const deleteWarehouse = async (user, warehouseId) => {
    const { Warehouse } = require('../../models');

    const warehouse = await Warehouse.findOne({
        where: { id: warehouseId, company_id: user.companyId },
    });

    if (!warehouse) {
        const err = new Error('Warehouse not found');
        err.statusCode = 404;
        throw err;
    }

    // Cannot delete the default warehouse if others exist
    if (warehouse.is_default) {
        const totalCount = await Warehouse.count({
            where: { company_id: user.companyId },
        });
        if (totalCount > 1) {
            const err = new Error('Cannot delete the default warehouse. Set another warehouse as default first.');
            err.statusCode = 400;
            throw err;
        }
    }

    await warehouse.destroy();
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

// ─── Set Default Warehouse ────────────────────────────────────────────────────
const setDefaultWarehouse = async (user, warehouseId) => {
    const { Warehouse } = require('../../models');

    const warehouse = await Warehouse.findOne({
        where: { id: warehouseId, company_id: user.companyId, status: 'active' },
    });

    if (!warehouse) {
        const err = new Error('Warehouse not found or inactive');
        err.statusCode = 404;
        throw err;
    }

    if (warehouse.is_default) {
        const err = new Error('This warehouse is already the default');
        err.statusCode = 400;
        throw err;
    }

    // Use transaction — unset old default + set new default atomically
    await sequelize.transaction(async (t) => {
        // Unset all defaults for this company
        await Warehouse.update(
            { is_default: false },
            { where: { company_id: user.companyId }, transaction: t }
        );
        // Set new default
        await warehouse.update({ is_default: true }, { transaction: t });
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return warehouse.reload();
};

module.exports = {
    getWarehouses,
    getWarehouseById,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    setDefaultWarehouse,
};