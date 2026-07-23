'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');

const normalizeString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const resolveCompanyId = (user, suppliedCompanyId) => {
    const tokenCompanyId = Number(user?.companyId);
    if (Number.isInteger(tokenCompanyId) && tokenCompanyId > 0) return tokenCompanyId;

    const companyId = Number(suppliedCompanyId);
    if (Number.isInteger(companyId) && companyId > 0) return companyId;

    const err = new Error('companyId is required');
    err.status = 400;
    err.statusCode = 400;
    throw err;
};

const cleanupExpired = async (transaction = null) => {
    const { WithdrawOrder } = require('../../models');

    return WithdrawOrder.destroy({
        where: {
            created_at: { [Op.lt]: sequelize.literal('DATE_SUB(NOW(), INTERVAL 7 DAY)') },
        },
        transaction,
    });
};

const toApi = (row) => ({
    companyId: String(row.company_id),
    platform: row.platform,
    storeId: row.store_id,
    orderId: row.order_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
});

const listWithdrawOrders = async (user, query) => {
    const { WithdrawOrder } = require('../../models');
    const companyId = resolveCompanyId(user, query.companyId);
    const platform = normalizeString(query.platform);
    const storeId = normalizeString(query.storeId);

    await cleanupExpired();

    const rows = await WithdrawOrder.findAll({
        where: {
            company_id: companyId,
            platform,
            store_id: storeId,
        },
        order: [['created_at', 'DESC']],
        raw: true,
    });

    return rows.map(toApi);
};

const upsertWithdrawOrders = async (user, body) => {
    const { WithdrawOrder } = require('../../models');
    const companyId = resolveCompanyId(user, body.companyId);
    const platform = normalizeString(body.platform);
    const storeId = normalizeString(body.storeId);
    const now = new Date();

    const rows = body.orders.map((order) => ({
        company_id: companyId,
        platform,
        store_id: storeId,
        order_id: normalizeString(order.orderId),
        updated_at: now,
    }));

    await sequelize.transaction(async (transaction) => {
        await cleanupExpired(transaction);
        await WithdrawOrder.bulkCreate(rows, {
            updateOnDuplicate: ['updated_at'],
            transaction,
        });
    });

    return { count: rows.length };
};

const deleteWithdrawOrders = async (user, body) => {
    const { WithdrawOrder } = require('../../models');
    const companyId = resolveCompanyId(user, body.companyId);
    const platform = normalizeString(body.platform);
    const storeId = normalizeString(body.storeId);
    const orderIds = body.orderIds.map(normalizeString);

    const deleted = await WithdrawOrder.destroy({
        where: {
            company_id: companyId,
            platform,
            store_id: storeId,
            order_id: { [Op.in]: orderIds },
        },
    });

    return { deleted };
};

module.exports = {
    listWithdrawOrders,
    upsertWithdrawOrders,
    deleteWithdrawOrders,
};
