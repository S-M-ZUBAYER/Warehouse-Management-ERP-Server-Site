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
    const { PushSuccessfulOrder } = require('../../models');

    return PushSuccessfulOrder.destroy({
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

const listPushSuccessfulOrders = async (user, query) => {
    const { PushSuccessfulOrder } = require('../../models');
    const companyId = resolveCompanyId(user, query.companyId);
    const platform = normalizeString(query.platform);
    const storeId = normalizeString(query.storeId);

    await cleanupExpired();

    const rows = await PushSuccessfulOrder.findAll({
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

const upsertPushSuccessfulOrders = async (user, body) => {
    const { PushSuccessfulOrder } = require('../../models');
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
        await PushSuccessfulOrder.bulkCreate(rows, {
            updateOnDuplicate: ['updated_at'],
            transaction,
        });
    });

    return { count: rows.length };
};

module.exports = {
    listPushSuccessfulOrders,
    upsertPushSuccessfulOrders,
};
