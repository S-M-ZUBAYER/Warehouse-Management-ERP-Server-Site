'use strict';

const { QueryTypes } = require('sequelize');
const {
    sequelize,
    PlatformProduct,
    SkuWarehouseStock,
    OrderSaleLine,
    PlatformStore,
} = require('../../models');

const toInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const pad2 = (value) => String(value).padStart(2, '0');

const getMonthRange = (yearInput, monthInput) => {
    const now = new Date();
    const year = toInt(yearInput, now.getFullYear());
    const month = Math.min(12, Math.max(1, toInt(monthInput, now.getMonth() + 1)));
    const start = `${year}-${pad2(month)}-01 00:00:00`;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const end = `${nextYear}-${pad2(nextMonth)}-01 00:00:00`;
    const daysInMonth = new Date(year, month, 0).getDate();

    return { year, month, start, end, daysInMonth };
};

const getTodayRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const start = `${year}-${pad2(month)}-${pad2(day)} 00:00:00`;

    const tomorrow = new Date(year, now.getMonth(), day + 1);
    const end = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())} 00:00:00`;

    return { start, end };
};

const makeEmptyDailyRows = ({ year, month, daysInMonth }, metricDefaults) => {
    return Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = `${year}-${pad2(month)}-${pad2(day)}`;
        return {
            date,
            day,
            label: `${pad2(day)}`,
            ...metricDefaults,
        };
    });
};

const getDashboardSummary = async (user) => {
    const companyId = user.companyId;
    const today = getTodayRange();

    const parentProducts = await PlatformProduct.count({
        distinct: true,
        col: 'platform_product_id',
        where: {
            company_id: companyId,
            row_type: 'parent',
        },
    });

    const childProducts = await PlatformProduct.count({
        distinct: true,
        col: 'platform_product_id',
        where: {
            company_id: companyId,
            row_type: 'child',
        },
    });

    const totalProducts = parentProducts || childProducts || 0;

    const todayOrderRows = await sequelize.query(
        `SELECT COUNT(DISTINCT platform_order_id) AS todayOrders
           FROM order_sale_lines
          WHERE company_id = :companyId
            AND sold_at >= :start
            AND sold_at < :end`,
        {
            type: QueryTypes.SELECT,
            replacements: { companyId, start: today.start, end: today.end },
        }
    );

    const stockRows = await sequelize.query(
        `SELECT
             COALESCE(SUM(qty_on_hand), 0) AS totalStockUnits,
             SUM(CASE
                    WHEN qty_on_hand > 0
                     AND min_stock IS NOT NULL
                     AND qty_on_hand <= min_stock
                    THEN 1 ELSE 0 END) AS lowStock,
             SUM(CASE WHEN qty_on_hand <= 0 THEN 1 ELSE 0 END) AS outOfStock
           FROM sku_warehouse_stock
          WHERE company_id = :companyId`,
        {
            type: QueryTypes.SELECT,
            replacements: { companyId },
        }
    );

    const platforms = await PlatformStore.findAll({
        where: { company_id: companyId, is_active: true },
        attributes: ['platform'],
        group: ['platform'],
        raw: true,
    });

    const stock = stockRows[0] || {};
    const todayOrders = todayOrderRows[0]?.todayOrders || 0;

    return {
        totalProducts: Number(totalProducts || 0),
        todayOrders: Number(todayOrders || 0),
        totalStockUnits: Number(stock.totalStockUnits || 0),
        lowStock: Number(stock.lowStock || 0),
        outOfStock: Number(stock.outOfStock || 0),
        platforms: platforms.map((p) => p.platform).filter(Boolean),
    };
};

const getInventoryStatus = async (user, query = {}) => {
    const companyId = user.companyId;
    const range = getMonthRange(query.year, query.month);

    const rows = await sequelize.query(
        `SELECT
             DATE(created_at) AS date,
             COALESCE(SUM(CASE WHEN quantity_delta > 0 THEN quantity_delta ELSE 0 END), 0) AS stockIn,
             COALESCE(SUM(CASE WHEN quantity_delta < 0 THEN ABS(quantity_delta) ELSE 0 END), 0) AS stockOut
           FROM stock_ledger_entries
          WHERE company_id = :companyId
            AND created_at >= :start
            AND created_at < :end
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC`,
        {
            type: QueryTypes.SELECT,
            replacements: {
                companyId,
                start: range.start,
                end: range.end,
            },
        }
    );

    const byDate = new Map(
        rows.map((row) => [
            row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
            row,
        ])
    );

    const data = makeEmptyDailyRows(range, { stockIn: 0, stockOut: 0 }).map((day) => {
        const row = byDate.get(day.date);
        return {
            ...day,
            stockIn: Number(row?.stockIn || 0),
            stockOut: Number(row?.stockOut || 0),
        };
    });

    return {
        year: range.year,
        month: range.month,
        data,
    };
};

const getSalesTrends = async (user, query = {}) => {
    const companyId = user.companyId;
    const range = getMonthRange(query.year, query.month);
    const platform = String(query.platform || '').trim().toLowerCase();

    const rows = await sequelize.query(
        `SELECT
             DATE(osl.sold_at) AS date,
             COALESCE(SUM(osl.quantity_sold), 0) AS quantity,
             COALESCE(SUM(osl.quantity_sold * COALESCE(osl.sale_price, 0)), 0) AS sales,
             COUNT(DISTINCT osl.platform_order_id) AS orders
           FROM order_sale_lines AS osl
           LEFT JOIN platform_sku_mappings AS psm
             ON psm.id = osl.platform_sku_mapping_id
           LEFT JOIN platform_stores AS ps
             ON ps.id = psm.platform_store_id
          WHERE osl.company_id = :companyId
            AND osl.sold_at >= :start
            AND osl.sold_at < :end
            AND (:platform = '' OR ps.platform = :platform)
          GROUP BY DATE(osl.sold_at)
          ORDER BY DATE(osl.sold_at) ASC`,
        {
            type: QueryTypes.SELECT,
            replacements: {
                companyId,
                start: range.start,
                end: range.end,
                platform,
            },
        }
    );

    const byDate = new Map(
        rows.map((row) => [
            row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
            row,
        ])
    );

    const data = makeEmptyDailyRows(range, { sales: 0, quantity: 0, orders: 0 }).map((day) => {
        const row = byDate.get(day.date);
        return {
            ...day,
            sales: Number(row?.sales || 0),
            quantity: Number(row?.quantity || 0),
            orders: Number(row?.orders || 0),
        };
    });

    return {
        year: range.year,
        month: range.month,
        platform: platform || 'all',
        data,
    };
};

module.exports = {
    getDashboardSummary,
    getInventoryStatus,
    getSalesTrends,
};
