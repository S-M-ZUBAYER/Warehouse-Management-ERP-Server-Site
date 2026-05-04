'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const redis = require('../../config/redis');

// Redis cache key
const cacheKey = (companyId, suffix = '') =>
    `company:${companyId}:cache:roles${suffix ? ':' + suffix : ''}`;

// Default permission structure matching the UI pages
const DEFAULT_PERMISSIONS = {
    dashboard: {
        access: false,
    },
    product_management: {
        access: false,
        sub: {
            product_list: false,
            combine_sku: false,
        },
    },
    inventory_management: {
        access: false,
        sub: {
            inventory_list: false,
            inbound: {
                access: false,
                sub: {
                    inbound_draft: false,
                    inbound_on_the_way: false,
                    inbound_complete: false,
                },
            },
        },
    },
    order_management: {
        access: false,
        sub: {
            order_processing: {
                access: false,
                sub: {
                    new_order: false,
                    processed_order: false,
                    shipped_order: false,
                    completed_order: false,
                    all_order: false,
                    canceled_order: false,
                },
            },
            manual_order: false,
        },
    },
    warehouse_management: {
        access: false,
    },
    system_configuration: {
        access: false,
        sub: {
            store_authorization: false,
            account_management: {
                access: false,
                sub: {
                    sub_account: false,
                    role_management: false,
                },
            },
        },
    },
};

// Merge user-supplied permissions over defaults (so missing keys default to false)
// const buildPermissions = (supplied = {}) => {
//     const result = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
//     for (const [page, val] of Object.entries(supplied)) {
//         if (!result[page]) continue;
//         if (typeof val.access === 'boolean') {
//             result[page].access = val.access;
//         }
//         if (val.sub && result[page].sub) {
//             for (const [subKey, subVal] of Object.entries(val.sub)) {
//                 if (subKey in result[page].sub) {
//                     result[page].sub[subKey] = Boolean(subVal);
//                 }
//             }
//         }
//     }
//     return result;
// };

const buildPermissions = (supplied = {}) => {
    const result = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));

    const mergeRecursive = (target, source) => {
        if (!source || typeof source !== 'object') return;

        // Handle "access" property
        if (typeof source.access === 'boolean') {
            target.access = source.access;
        }

        // Handle "sub" property
        if (source.sub && target.sub) {
            for (const [key, value] of Object.entries(source.sub)) {
                if (target.sub.hasOwnProperty(key)) {
                    if (typeof value === 'object' && value !== null && typeof target.sub[key] === 'object') {
                        mergeRecursive(target.sub[key], value);
                    } else {
                        target.sub[key] = Boolean(value);
                    }
                }
            }
        }
    };

    // ✅ Iterate over each top-level permission key
    for (const [key, value] of Object.entries(supplied)) {
        if (result.hasOwnProperty(key)) {
            mergeRecursive(result[key], value);
        }
    }

    return result;
};

// ─── Get All Roles ────────────────────────────────────────────────────────────
const getRoles = async (user, filters = {}) => {
    const { Role, User } = require('../../models');
    const { page = 1, limit = 20, search, subAccountLinkingStatus } = filters;

    // Cache for plain list
    const key = cacheKey(user.companyId, `p${page}:l${limit}`);
    if (!search && !subAccountLinkingStatus) {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);
    }

    const where = { company_id: user.companyId };
    if (subAccountLinkingStatus) where.sub_account_linking_status = subAccountLinkingStatus;
    if (search) {
        where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { description: { [Op.like]: `%${search}%` } },
        ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Role.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
    });

    // Append user count per role
    const roleIds = rows.map(r => r.id);
    const userCounts = await User.findAll({
        where: { role_id: { [Op.in]: roleIds }, company_id: user.companyId },
        attributes: ['role_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['role_id'],
        raw: true,
    });
    const countMap = {};
    userCounts.forEach(r => { countMap[r.role_id] = parseInt(r.count); });

    const data = rows.map(role => ({
        ...role.toJSON(),
        user_count: countMap[role.id] || 0,
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

    if (!search && !subAccountLinkingStatus) {
        await redis.set(key, JSON.stringify(result), { EX: 120 });
    }

    return result;
};

// ─── Get Single Role ──────────────────────────────────────────────────────────
const getRoleById = async (user, roleId) => {
    const { Role, User } = require('../../models');

    const role = await Role.findOne({
        where: { id: roleId, company_id: user.companyId },
    });

    if (!role) {
        const err = new Error('Role not found');
        err.statusCode = 404;
        throw err;
    }

    // Count sub accounts using this role
    const userCount = await User.count({
        where: { role_id: roleId, company_id: user.companyId },
    });

    return { ...role.toJSON(), user_count: userCount };
};

// ─── Create Role ──────────────────────────────────────────────────────────────
const createRole = async (user, data) => {
    const { Role } = require('../../models');

    // Only owner/admin can create roles
    if (!['owner', 'admin'].includes(user.role)) {
        const err = new Error('Permission denied');
        err.statusCode = 403;
        throw err;
    }

    const { name, description, permissions, subAccountLinkingStatus } = data;
    console.log(permissions, "permissions");
    // Check name unique within company
    const existing = await Role.findOne({
        where: { company_id: user.companyId, name: name.trim() },
    });
    if (existing) {
        const err = new Error('A role with this name already exists');
        err.statusCode = 409;
        throw err;
    }

    const role = await Role.create({
        company_id: user.companyId,
        name: name.trim(),
        description: description || null,
        permissions: buildPermissions(permissions || {}),
        sub_account_linking_status: subAccountLinkingStatus || 'not_linked',
    });

    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return role;
};

// ─── Update Role ──────────────────────────────────────────────────────────────
const updateRole = async (user, roleId, data) => {
    const { Role } = require('../../models');

    if (!['owner', 'admin'].includes(user.role)) {
        const err = new Error('Permission denied');
        err.statusCode = 403;
        throw err;
    }

    const role = await Role.findOne({
        where: { id: roleId, company_id: user.companyId },
    });

    if (!role) {
        const err = new Error('Role not found');
        err.statusCode = 404;
        throw err;
    }

    // Prevent editing the built-in Owner role
    if (role.name === 'Owner') {
        const err = new Error('The Owner role cannot be modified');
        err.statusCode = 403;
        throw err;
    }

    // Check new name not duplicate
    if (data.name && data.name.trim() !== role.name) {
        const duplicate = await Role.findOne({
            where: {
                company_id: user.companyId,
                name: data.name.trim(),
                id: { [Op.ne]: roleId },
            },
        });
        if (duplicate) {
            const err = new Error('A role with this name already exists');
            err.statusCode = 409;
            throw err;
        }
    }

    const updates = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description;

    // Merge new permissions on top of existing ones
    if (data.permissions !== undefined) {
        const existing = role.permissions || {};
        updates.permissions = buildPermissions({ ...existing, ...data.permissions });
    }

    if (data.subAccountLinkingStatus !== undefined) {
        updates.sub_account_linking_status = data.subAccountLinkingStatus;
    }

    await role.update(updates);
    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return role.reload();
};

// ─── Delete Role ──────────────────────────────────────────────────────────────
const deleteRole = async (user, roleId) => {
    const { Role, User } = require('../../models');

    if (!['owner', 'admin'].includes(user.role)) {
        const err = new Error('Permission denied');
        err.statusCode = 403;
        throw err;
    }

    const role = await Role.findOne({
        where: { id: roleId, company_id: user.companyId },
    });

    if (!role) {
        const err = new Error('Role not found');
        err.statusCode = 404;
        throw err;
    }

    // Prevent deleting Owner role
    if (role.name === 'Owner') {
        const err = new Error('The Owner role cannot be deleted');
        err.statusCode = 403;
        throw err;
    }

    // Prevent deleting role that has active sub accounts
    const usersWithRole = await User.count({
        where: { role_id: roleId, company_id: user.companyId },
    });
    if (usersWithRole > 0) {
        const err = new Error(`Cannot delete role. ${usersWithRole} sub account(s) are using this role. Reassign them first.`);
        err.statusCode = 400;
        throw err;
    }

    await role.destroy();
    await redis.flushByPattern(cacheKey(user.companyId, '*'));
};

// ─── Update Permissions Only ──────────────────────────────────────────────────
const updatePermissions = async (user, roleId, permissions) => {
    const { Role } = require('../../models');

    if (!['owner', 'admin'].includes(user.role)) {
        const err = new Error('Permission denied');
        err.statusCode = 403;
        throw err;
    }

    const role = await Role.findOne({
        where: { id: roleId, company_id: user.companyId },
    });

    if (!role) {
        const err = new Error('Role not found');
        err.statusCode = 404;
        throw err;
    }

    if (role.name === 'Owner') {
        const err = new Error('The Owner role permissions cannot be modified');
        err.statusCode = 403;
        throw err;
    }

    const updatedPermissions = buildPermissions(permissions);
    await role.update({ permissions: updatedPermissions });
    await redis.flushByPattern(cacheKey(user.companyId, '*'));

    return role.reload();
};

// ─── Get Permission Template ──────────────────────────────────────────────────
// Returns the full permission structure with all pages and sub-pages
// Frontend uses this to render the checkbox UI
const getPermissionTemplate = () => {
    return {
        pages: [
            {
                key: 'dashboard',
                label: 'Dashboard',
                hasSub: false,
            },
            {
                key: 'product_management',
                label: 'Product Management',
                hasSub: true,
                sub: [
                    { key: 'product_list', label: 'Product List' },
                    { key: 'combine_sku', label: 'Combine SKU' },
                ],
            },
            {
                key: 'inventory_management',
                label: 'Inventory Management',
                hasSub: true,
                sub: [
                    { key: 'inventory_list', label: 'Inventory List' },
                    {
                        key: 'inbound',
                        label: 'Inbound',
                        hasSub: true, // Now has level-3 children
                        sub: [
                            { key: 'inbound_draft', label: 'Inbound Draft' },
                            { key: 'inbound_on_the_way', label: 'Inbound On The Way' },
                            { key: 'inbound_complete', label: 'Inbound Complete' },
                        ]
                    },
                ],
            },
            {
                key: 'order_management',
                label: 'Order Management',
                hasSub: true,
                sub: [
                    {
                        key: 'order_processing',
                        label: 'Order Processing',
                        hasSub: true, // Now has level-3 children
                        sub: [
                            { key: 'new_order', label: 'New Order' },
                            { key: 'processed_order', label: 'Processed Order' },
                            { key: 'shipped_order', label: 'Shipped Order' },
                            { key: 'completed_order', label: 'Completed Order' },
                            { key: 'all_order', label: 'All Orders' },
                            { key: 'canceled_order', label: 'Canceled Order' },
                        ]
                    },
                    { key: 'manual_order', label: 'Manual Order' },
                ],
            },
            {
                key: 'warehouse_management',
                label: 'Warehouse Management',
                hasSub: false,
            },
            {
                key: 'system_configuration',
                label: 'System Configuration',
                hasSub: true,
                sub: [
                    { key: 'store_authorization', label: 'Store Authorization' },
                    {
                        key: 'account_management',
                        label: 'Account Management',
                        hasSub: true,
                        sub: [
                            { key: 'sub_account', label: 'Sub Account' },
                            { key: 'role_management', label: 'Role Management' },
                        ]
                    },
                ],
            },
        ],
        defaultPermissions: DEFAULT_PERMISSIONS,
    };
};

module.exports = {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    updatePermissions,
    getPermissionTemplate,
};