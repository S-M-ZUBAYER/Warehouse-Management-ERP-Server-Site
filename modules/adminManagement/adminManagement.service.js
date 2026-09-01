'use strict';

const { Op, QueryTypes } = require('sequelize');

const SUPPORTED_PLATFORMS = new Set(['tiktok', 'shopee']);

const normalize = (value) => String(value || '').trim();
const lower = (value) => normalize(value).toLowerCase();
const toPositiveInteger = (value, fallback) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
};
const parseBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const normalizePlatform = (value) => {
    const platform = lower(value || 'tiktok');
    return SUPPORTED_PLATFORMS.has(platform) ? platform : 'tiktok';
};
const normalizeTransactionPlatform = (value) => {
    const platform = lower(value || 'all');
    return platform === 'all' || SUPPORTED_PLATFORMS.has(platform) ? platform : 'all';
};
const toNumber = (value) => Number(Number(value || 0).toFixed(2));

const parseJsonObject = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const GIFT_STATUS_ALIASES = {
    pending_address: 'PENDING_ADDRESS',
    address_submitted: 'ADDRESS_SUBMITTED',
    submitted: 'ADDRESS_SUBMITTED',
    processing: 'ADDRESS_SUBMITTED',
    on_the_way: 'ON_THE_WAY',
    shipped: 'ON_THE_WAY',
    delivered: 'DELIVERED',
    received: 'RECEIVED',
    declined: 'DECLINED',
    cancelled: 'CANCELLED',
    canceled: 'CANCELLED',
};

const normalizeGiftStatus = (value, fallback = null) => {
    const normalized = lower(value).replace(/[\s-]+/g, '_');
    if (!normalized || normalized === 'all') return fallback;
    return GIFT_STATUS_ALIASES[normalized] || upperGiftStatus(normalized) || fallback;
};

const upperGiftStatus = (value) => {
    const status = String(value || '').trim().toUpperCase();
    return ['PENDING_ADDRESS', 'ADDRESS_SUBMITTED', 'ON_THE_WAY', 'DELIVERED', 'RECEIVED', 'DECLINED', 'CANCELLED'].includes(status)
        ? status
        : null;
};

const toApiGiftStatus = (value) => lower(value);

const getAddressValue = (address, ...keys) => {
    const parsed = parseJsonObject(address);
    for (const key of keys) {
        const value = parsed[key];
        if (value !== undefined && value !== null && normalize(value) !== '') return value;
    }
    return null;
};

const getDateRangeWhere = ({ startDate, endDate }) => {
    const createdAt = {};
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) createdAt[Op.gte] = start;
    }
    if (endDate) {
        const end = new Date(`${endDate}T00:00:00.000Z`);
        if (!Number.isNaN(end.getTime())) {
            end.setUTCDate(end.getUTCDate() + 1);
            createdAt[Op.lt] = end;
        }
    }
    return Object.keys(createdAt).length ? createdAt : null;
};

const getSearchCompanyIds = async (search) => {
    const term = normalize(search);
    if (!term) return [];

    const { Company, User } = require('../../models');
    const like = { [Op.like]: `%${term}%` };
    const [companies, users] = await Promise.all([
        Company.findAll({
            attributes: ['id'],
            where: { [Op.or]: [{ name: like }, { email: like }] },
            raw: true,
        }),
        User.findAll({
            attributes: ['company_id'],
            where: { [Op.or]: [{ email: like }, { name: like }] },
            raw: true,
        }),
    ]);

    return [
        ...new Set([
            ...companies.map((company) => Number(company.id)),
            ...users.map((user) => Number(user.company_id)),
        ].filter((id) => Number.isInteger(id) && id > 0)),
    ];
};

const getCompanyRows = async (companyIds) => {
    const ids = [...new Set(companyIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return new Map();

    const { Company } = require('../../models');
    const companies = await Company.findAll({
        attributes: ['id', 'name', 'email', 'status'],
        where: { id: { [Op.in]: ids } },
        raw: true,
    });

    return new Map(companies.map((company) => [Number(company.id), company]));
};

const getPrimaryUsers = async (companyIds) => {
    const ids = [...new Set(companyIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return new Map();

    const { User } = require('../../models');
    const users = await User.findAll({
        attributes: ['id', 'company_id', 'name', 'email', 'role', 'is_active'],
        where: { company_id: { [Op.in]: ids } },
        order: [
            ['company_id', 'ASC'],
            ['id', 'ASC'],
        ],
        raw: true,
    });

    const byCompany = new Map();
    users.forEach((user) => {
        const companyId = Number(user.company_id);
        const current = byCompany.get(companyId);
        if (!current || lower(user.role) === 'owner') {
            byCompany.set(companyId, user);
        }
    });
    return byCompany;
};

const serializeStore = (store) => {
    const row = typeof store.toJSON === 'function' ? store.toJSON() : store;
    const subscription = row.subscription || {};
    return {
        id: row.id,
        storeName: row.store_name || row.external_store_name || `Store #${row.id}`,
        externalStoreName: row.external_store_name || null,
        externalStoreId: row.external_store_id || null,
        storeShopId: row.store_shop_id || null,
        country: row.region || null,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at || row.createdAt || null,
        subscriptionStatus: subscription.status || null,
        subscriptionLabel: subscription.statusLabel || subscription.status || null,
        expiresAt: subscription.expiresAt || subscription.expires_at || null,
        remainingDays: subscription.remainingDays ?? null,
        currentPlan: subscription.planName || subscription.plan?.name || subscription.currentPlan || null,
        currentPlanCode: subscription.planCode || subscription.plan?.code || null,
    };
};

const listPlatformStoreUsers = async (filters = {}) => {
    const { PlatformStore } = require('../../models');
    const subscriptionService = require('../subscription/subscription.service');

    const platform = normalizePlatform(filters.platform);
    const page = Math.max(1, toPositiveInteger(filters.page, 1));
    const limit = Math.min(500, Math.max(1, toPositiveInteger(filters.limit, 20)));
    const exportMode = parseBoolean(filters.export);
    const search = normalize(filters.search);
    const includeDeleted = parseBoolean(filters.includeDeleted);
    const storeCreatedAt = getDateRangeWhere(filters);

    const where = { platform };
    if (!includeDeleted) where.deleted_at = null;
    if (storeCreatedAt) where.created_at = storeCreatedAt;

    if (search) {
        const like = { [Op.like]: `%${search}%` };
        const searchCompanyIds = await getSearchCompanyIds(search);
        where[Op.or] = [
            { store_name: like },
            { external_store_name: like },
            { external_store_id: like },
            { store_shop_id: like },
            ...(searchCompanyIds.length ? [{ company_id: { [Op.in]: searchCompanyIds } }] : []),
        ];
    }

    const stores = await PlatformStore.findAll({
        where,
        attributes: { exclude: ['access_token', 'refresh_token', 'webhook_secret'] },
        order: [
            ['company_id', 'ASC'],
            ['store_name', 'ASC'],
            ['id', 'ASC'],
        ],
        paranoid: !includeDeleted,
    });

    const rowsWithSubscriptions = await subscriptionService.appendSubscriptionSnapshots(stores);
    const grouped = new Map();

    rowsWithSubscriptions.forEach((store) => {
        const row = typeof store.toJSON === 'function' ? store.toJSON() : store;
        const companyId = Number(row.company_id);
        if (!grouped.has(companyId)) {
            grouped.set(companyId, {
                companyId,
                companyName: null,
                companyEmail: null,
                companyStatus: null,
                userId: null,
                email: null,
                name: null,
                role: null,
                platform,
                storeCount: 0,
                stores: [],
            });
        }
        const group = grouped.get(companyId);
        group.stores.push(serializeStore(row));
        group.storeCount = group.stores.length;
    });

    const groups = [...grouped.values()];
    const companyIds = groups.map((group) => group.companyId);
    const [companyRows, primaryUsers] = await Promise.all([
        getCompanyRows(companyIds),
        getPrimaryUsers(companyIds),
    ]);

    groups.forEach((group) => {
        const company = companyRows.get(group.companyId);
        const user = primaryUsers.get(group.companyId);
        group.companyName = company?.name || null;
        group.companyEmail = company?.email || null;
        group.companyStatus = company?.status || null;
        group.userId = user?.id || null;
        group.email = user?.email || company?.email || null;
        group.name = user?.name || null;
        group.role = user?.role || null;
        group.storeNames = group.stores.map((store) => store.storeName).filter(Boolean);
        group.storeIds = group.stores.map((store) => store.id).filter(Boolean);
        group.countries = [...new Set(group.stores.map((store) => store.country).filter(Boolean))];
        group.latestExpiryAt = group.stores
            .map((store) => store.expiresAt)
            .filter(Boolean)
            .sort()
            .at(-1) || null;
    });

    groups.sort((left, right) =>
        String(left.email || left.companyName || '').localeCompare(String(right.email || right.companyName || '')) ||
        Number(left.companyId) - Number(right.companyId)
    );

    const total = groups.length;
    const pagedRows = exportMode ? groups : groups.slice((page - 1) * limit, page * limit);

    return {
        data: pagedRows,
        pagination: {
            total,
            page,
            limit: exportMode ? total || limit : limit,
            totalPages: exportMode ? 1 : Math.ceil(total / limit),
        },
        filters: {
            platform,
            search: search || null,
            startDate: filters.startDate || null,
            endDate: filters.endDate || null,
            includeDeleted,
            export: exportMode,
        },
    };
};

const getTransactionDateRange = ({ startDate, endDate }) => {
    const range = {};
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) range.startAt = start;
    }
    if (endDate) {
        const end = new Date(`${endDate}T00:00:00.000Z`);
        if (!Number.isNaN(end.getTime())) {
            end.setUTCDate(end.getUTCDate() + 1);
            range.endBefore = end;
        }
    }
    return range;
};

const serializeTransaction = (row) => {
    const metadata = parseJsonObject(row.metadata);
    const platform = lower(row.platform);
    return {
        id: row.id,
        paymentUid: row.paymentUid,
        paymentGroupUid: row.paymentGroupUid,
        platform,
        storeId: row.storeId,
        storeName: row.storeName || (row.storeId ? `Store #${row.storeId}` : null),
        externalStoreId: row.externalStoreId || null,
        storeShopId: row.storeShopId || null,
        country: row.country || null,
        companyId: row.companyId,
        companyName: row.companyName || null,
        companyEmail: row.companyEmail || null,
        purchaserUserId: row.purchaserUserId || null,
        purchaserUserName: row.purchaserUserName || null,
        purchaserUserEmail: row.purchaserUserEmail || null,
        purchaserEmail: row.purchaserEmail || row.purchaserUserEmail || null,
        planName: row.planName || null,
        planCode: row.planCode || null,
        amount: toNumber(row.amount),
        currency: row.currency || null,
        paymentProvider: row.paymentProvider || null,
        paymentStatus: row.paymentStatus || null,
        paidAt: row.paidAt || null,
        transactionAt: row.paidAt || row.createdAt || null,
        previousExpiry: row.previousExpiry || null,
        newExpiry: row.newExpiry || null,
        couponCode: row.couponCode || null,
        redeemedCouponCode: metadata.redeemedCouponCode || metadata.redeemed_coupon_code || null,
        createdAt: row.createdAt || null,
    };
};

const buildCurrencyBreakdown = (rows) => {
    const byCurrency = new Map();
    rows.forEach((row) => {
        const currency = row.currency || 'UNKNOWN';
        const current = byCurrency.get(currency) || { currency, amount: 0, transactions: 0 };
        current.amount = toNumber(current.amount + toNumber(row.amount));
        current.transactions += 1;
        byCurrency.set(currency, current);
    });
    return [...byCurrency.values()].sort((left, right) => left.currency.localeCompare(right.currency));
};

const summarizeTransactions = (rows) => {
    const makeSummary = (items) => ({
        transactions: items.length,
        amount: toNumber(items.reduce((sum, row) => sum + toNumber(row.amount), 0)),
        currencyBreakdown: buildCurrencyBreakdown(items),
    });

    const tiktokRows = rows.filter((row) => row.platform === 'tiktok');
    const shopeeRows = rows.filter((row) => row.platform === 'shopee');
    const total = makeSummary(rows);

    return {
        totalTransactions: total.transactions,
        totalAmount: total.amount,
        currencyBreakdown: total.currencyBreakdown,
        platforms: {
            tiktok: makeSummary(tiktokRows),
            shopee: makeSummary(shopeeRows),
        },
    };
};

const getWalletPaymentDateRange = (filters = {}) => {
    const startValue = filters.startDate || filters.dateFrom;
    const endValue = filters.endDate || filters.dateTo;
    const range = {};

    if (startValue) {
        const start = new Date(`${startValue}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) range.startAt = start;
    }
    if (endValue) {
        const end = new Date(`${endValue}T00:00:00.000Z`);
        if (!Number.isNaN(end.getTime())) {
            end.setUTCDate(end.getUTCDate() + 1);
            range.endBefore = end;
        }
    }

    return range;
};

const toMetadataNumber = (metadata, ...keys) => {
    for (const key of keys) {
        const value = metadata?.[key];
        if (value !== undefined && value !== null && value !== '') return toNumber(value);
    }
    return 0;
};

const serializeShippingWalletPayment = (row) => {
    const metadata = parseJsonObject(row.metadata);
    const feeOrReserveMyr = toMetadataNumber(metadata, 'topUpFeeReserveMyr', 'feeOrReserveMyr');
    const grossMyrAmount = toMetadataNumber(metadata, 'grossAmountMyr') || toNumber(toNumber(row.amountMyr) + feeOrReserveMyr);
    const stripeSessionId = metadata.stripeSessionId || row.reference || null;
    const customerEmail = row.createdByEmail || row.ownerEmail || row.companyEmail || null;

    return {
        id: row.id,
        ledgerId: row.id,
        companyId: row.companyId,
        companyName: row.companyName || null,
        companyEmail: row.companyEmail || null,
        ownerUserId: row.ownerUserId || null,
        ownerName: row.ownerName || null,
        ownerEmail: row.ownerEmail || null,
        customerUserId: row.createdByUserId || null,
        customerName: row.createdByName || row.ownerName || null,
        customerEmail,
        walletId: row.walletId,
        walletBalanceMyr: toNumber(row.walletBalanceMyr),
        transactionType: row.type,
        type: row.type,
        status: row.status,
        paidAmount: row.originalAmount == null ? null : toNumber(row.originalAmount),
        paidCurrency: row.originalCurrency || null,
        originalAmount: row.originalAmount == null ? null : toNumber(row.originalAmount),
        originalCurrency: row.originalCurrency || null,
        fxRateToMyr: row.fxRateToMyr == null ? null : Number(row.fxRateToMyr),
        grossMyrAmount,
        creditedMyrAmount: toNumber(row.amountMyr),
        amountMyr: toNumber(row.amountMyr),
        feeOrReserveMyr,
        balanceBeforeMyr: toNumber(row.balanceBeforeMyr),
        balanceAfterMyr: toNumber(row.balanceAfterMyr),
        provider: row.provider || null,
        paymentProvider: row.provider || null,
        reference: row.reference || null,
        stripeSessionId,
        stripePaymentIntentId: metadata.stripePaymentIntentId || null,
        stripeAmountTotal: metadata.stripeAmountTotal ?? null,
        stripeCurrency: metadata.stripeCurrency || null,
        fxSource: metadata.fxSource || null,
        createdAt: row.createdAt || null,
        paidAt: row.createdAt || null,
        metadata,
    };
};

const buildOriginalCurrencySummary = (rows) => {
    const byCurrency = new Map();
    rows.forEach((row) => {
        const currency = row.paidCurrency || row.originalCurrency || 'UNKNOWN';
        const current = byCurrency.get(currency) || { currency, amount: 0, transactions: 0 };
        current.amount = toNumber(current.amount + toNumber(row.paidAmount || row.originalAmount || 0));
        current.transactions += 1;
        byCurrency.set(currency, current);
    });
    return [...byCurrency.values()].sort((left, right) => left.currency.localeCompare(right.currency));
};

const summarizeShippingWalletPayments = (rows) => {
    const totalPaidOriginal = rows.reduce((acc, row) => {
        const currency = row.paidCurrency || row.originalCurrency || 'UNKNOWN';
        acc[currency] = toNumber((acc[currency] || 0) + toNumber(row.paidAmount || row.originalAmount || 0));
        return acc;
    }, {});
    const byStatus = new Map();
    rows.forEach((row) => {
        const status = row.status || 'unknown';
        const current = byStatus.get(status) || { status, transactions: 0, creditedMyrAmount: 0 };
        current.transactions += 1;
        current.creditedMyrAmount = toNumber(current.creditedMyrAmount + toNumber(row.creditedMyrAmount));
        byStatus.set(status, current);
    });

    return {
        totalTopUps: rows.length,
        totalPaidOriginal,
        originalCurrencyBreakdown: buildOriginalCurrencySummary(rows),
        totalGrossMyr: toNumber(rows.reduce((sum, row) => sum + toNumber(row.grossMyrAmount), 0)),
        totalCreditedMyr: toNumber(rows.reduce((sum, row) => sum + toNumber(row.creditedMyrAmount), 0)),
        totalFeeOrReserveMyr: toNumber(rows.reduce((sum, row) => sum + toNumber(row.feeOrReserveMyr), 0)),
        statusBreakdown: [...byStatus.values()].sort((left, right) => left.status.localeCompare(right.status)),
    };
};

const listShippingWalletPayments = async (filters = {}) => {
    const { sequelize } = require('../../models');

    const page = Math.max(1, toPositiveInteger(filters.page, 1));
    const limit = Math.min(500, Math.max(1, toPositiveInteger(filters.limit, 20)));
    const exportMode = parseBoolean(filters.export);
    const search = normalize(filters.search || filters.email);
    const companyId = toPositiveInteger(filters.companyId, null);
    const currency = normalize(filters.currency).toUpperCase();
    const status = lower(filters.status || 'all');
    const { startAt, endBefore } = getWalletPaymentDateRange(filters);
    const replacements = {};
    const where = ['l.type = \'topup\''];

    if (companyId) {
        where.push('l.company_id = :companyId');
        replacements.companyId = companyId;
    }
    if (currency && currency !== 'ALL') {
        where.push('UPPER(COALESCE(l.original_currency, \'\')) = :currency');
        replacements.currency = currency;
    }
    if (status && status !== 'all') {
        where.push('LOWER(COALESCE(l.status, \'\')) = :status');
        replacements.status = status;
    }
    if (startAt) {
        where.push('l.created_at >= :startAt');
        replacements.startAt = startAt;
    }
    if (endBefore) {
        where.push('l.created_at < :endBefore');
        replacements.endBefore = endBefore;
    }
    if (search) {
        replacements.search = `%${search.toLowerCase()}%`;
        where.push(`(
            LOWER(COALESCE(c.name, '')) LIKE :search OR
            LOWER(COALESCE(c.email, '')) LIKE :search OR
            LOWER(COALESCE(created_user.name, '')) LIKE :search OR
            LOWER(COALESCE(created_user.email, '')) LIKE :search OR
            LOWER(COALESCE(owner_user.name, '')) LIKE :search OR
            LOWER(COALESCE(owner_user.email, '')) LIKE :search OR
            LOWER(COALESCE(l.reference, '')) LIKE :search OR
            LOWER(COALESCE(l.provider, '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.stripeSessionId')), '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.stripePaymentIntentId')), '')) LIKE :search OR
            CAST(l.id AS CHAR) LIKE :search
        )`);
    }

    const rows = await sequelize.query(
        `
        SELECT
            l.id,
            l.company_id AS companyId,
            c.name AS companyName,
            c.email AS companyEmail,
            owner_user.id AS ownerUserId,
            owner_user.name AS ownerName,
            owner_user.email AS ownerEmail,
            created_user.id AS createdByUserId,
            created_user.name AS createdByName,
            created_user.email AS createdByEmail,
            l.wallet_id AS walletId,
            w.balance_myr AS walletBalanceMyr,
            l.type,
            l.status,
            l.amount_myr AS amountMyr,
            l.balance_before_myr AS balanceBeforeMyr,
            l.balance_after_myr AS balanceAfterMyr,
            l.original_amount AS originalAmount,
            l.original_currency AS originalCurrency,
            l.fx_rate_to_myr AS fxRateToMyr,
            l.provider,
            l.reference,
            l.metadata,
            l.created_at AS createdAt
        FROM company_shipping_wallet_ledger l
        LEFT JOIN companies c ON c.id = l.company_id
        LEFT JOIN company_shipping_wallets w ON w.id = l.wallet_id
        LEFT JOIN users created_user ON created_user.id = l.created_by
        LEFT JOIN (
            SELECT company_id, MIN(id) AS owner_user_id
            FROM users
            WHERE role = 'owner'
            GROUP BY company_id
        ) owner_pick ON owner_pick.company_id = l.company_id
        LEFT JOIN users owner_user ON owner_user.id = owner_pick.owner_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY l.created_at DESC, l.id DESC
        `,
        { replacements, type: QueryTypes.SELECT }
    );

    const serializedRows = rows.map(serializeShippingWalletPayment);
    const total = serializedRows.length;
    const pagedRows = exportMode ? serializedRows : serializedRows.slice((page - 1) * limit, page * limit);

    return {
        rows: pagedRows,
        summary: summarizeShippingWalletPayments(serializedRows),
        pagination: {
            total,
            page,
            limit: exportMode ? total || limit : limit,
            totalPages: exportMode ? 1 : Math.ceil(total / limit),
        },
        filters: {
            search: search || null,
            companyId: companyId || null,
            currency: currency && currency !== 'ALL' ? currency : 'all',
            status: status || 'all',
            startDate: filters.startDate || filters.dateFrom || null,
            endDate: filters.endDate || filters.dateTo || null,
            export: exportMode,
        },
    };
};

const listPlatformTransactions = async (filters = {}) => {
    const { sequelize } = require('../../models');

    const platform = normalizeTransactionPlatform(filters.platform);
    const page = Math.max(1, toPositiveInteger(filters.page, 1));
    const limit = Math.min(500, Math.max(1, toPositiveInteger(filters.limit, 20)));
    const exportMode = parseBoolean(filters.export);
    const search = normalize(filters.search);
    const { startAt, endBefore } = getTransactionDateRange(filters);
    const replacements = {};
    const where = [];

    if (platform !== 'all') {
        where.push('LOWER(COALESCE(ps.platform, ss.platform, \'\')) = :platform');
        replacements.platform = platform;
    } else {
        where.push('LOWER(COALESCE(ps.platform, ss.platform, \'\')) IN (\'tiktok\', \'shopee\')');
    }

    if (startAt) {
        where.push('COALESCE(sp.paid_at, sp.created_at) >= :startAt');
        replacements.startAt = startAt;
    }
    if (endBefore) {
        where.push('COALESCE(sp.paid_at, sp.created_at) < :endBefore');
        replacements.endBefore = endBefore;
    }

    if (search) {
        replacements.search = `%${search.toLowerCase()}%`;
        where.push(`(
            LOWER(COALESCE(sp.payment_uid, '')) LIKE :search OR
            LOWER(COALESCE(sp.payment_group_uid, '')) LIKE :search OR
            LOWER(COALESCE(sp.purchaser_email, '')) LIKE :search OR
            LOWER(COALESCE(sp.coupon_code, '')) LIKE :search OR
            LOWER(COALESCE(ps.store_name, '')) LIKE :search OR
            LOWER(COALESCE(ps.external_store_name, '')) LIKE :search OR
            LOWER(COALESCE(ps.external_store_id, '')) LIKE :search OR
            LOWER(COALESCE(ps.store_shop_id, '')) LIKE :search OR
            LOWER(COALESCE(ss.external_shop_id, '')) LIKE :search OR
            LOWER(COALESCE(c.name, '')) LIKE :search OR
            LOWER(COALESCE(c.email, '')) LIKE :search OR
            LOWER(COALESCE(u.name, '')) LIKE :search OR
            LOWER(COALESCE(u.email, '')) LIKE :search OR
            LOWER(COALESCE(bp.name, '')) LIKE :search OR
            LOWER(COALESCE(bp.code, '')) LIKE :search OR
            CAST(sp.id AS CHAR) LIKE :search
        )`);
    }

    const rows = await sequelize.query(
        `
        SELECT
            sp.id,
            sp.payment_uid AS paymentUid,
            sp.payment_group_uid AS paymentGroupUid,
            COALESCE(ps.platform, ss.platform) AS platform,
            ps.id AS storeId,
            COALESCE(ps.store_name, ps.external_store_name, ss.external_shop_id) AS storeName,
            COALESCE(ps.external_store_id, ss.external_shop_id) AS externalStoreId,
            ps.store_shop_id AS storeShopId,
            COALESCE(ps.region, ss.marketplace_country) AS country,
            c.id AS companyId,
            c.name AS companyName,
            c.email AS companyEmail,
            u.id AS purchaserUserId,
            u.name AS purchaserUserName,
            u.email AS purchaserUserEmail,
            sp.purchaser_email AS purchaserEmail,
            bp.name AS planName,
            bp.code AS planCode,
            sp.amount,
            sp.currency,
            sp.payment_provider AS paymentProvider,
            sp.payment_status AS paymentStatus,
            sp.paid_at AS paidAt,
            sp.previous_expiry AS previousExpiry,
            sp.new_expiry AS newExpiry,
            sp.coupon_code AS couponCode,
            sp.metadata,
            sp.created_at AS createdAt
        FROM subscription_payments sp
        LEFT JOIN platform_stores ps ON ps.id = sp.platform_store_id
        LEFT JOIN store_subscriptions ss ON ss.id = sp.store_subscription_id
        LEFT JOIN billing_plans bp ON bp.id = sp.plan_id
        LEFT JOIN companies c ON c.id = sp.purchaser_company_id
        LEFT JOIN users u ON u.id = sp.purchaser_user_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY COALESCE(sp.paid_at, sp.created_at) DESC, sp.id DESC
        `,
        { replacements, type: QueryTypes.SELECT }
    );

    const serializedRows = rows.map(serializeTransaction);
    const total = serializedRows.length;
    const pagedRows = exportMode ? serializedRows : serializedRows.slice((page - 1) * limit, page * limit);

    return {
        rows: pagedRows,
        summary: summarizeTransactions(serializedRows),
        pagination: {
            total,
            page,
            limit: exportMode ? total || limit : limit,
            totalPages: exportMode ? 1 : Math.ceil(total / limit),
        },
        filters: {
            platform,
            search: search || null,
            startDate: filters.startDate || null,
            endDate: filters.endDate || null,
            export: exportMode,
        },
    };
};

const getGiftDateRange = ({ startDate, endDate }) => {
    const range = {};
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) range.startAt = start;
    }
    if (endDate) {
        const end = new Date(`${endDate}T00:00:00.000Z`);
        if (!Number.isNaN(end.getTime())) {
            end.setUTCDate(end.getUTCDate() + 1);
            range.endBefore = end;
        }
    }
    return range;
};

const serializeGiftRow = (row) => ({
    id: row.id,
    status: toApiGiftStatus(row.status),
    ownerUserId: row.ownerUserId || null,
    ownerEmail: row.ownerEmail || null,
    ownerName: row.ownerName || null,
    ownerCompanyId: row.ownerCompanyId || null,
    ownerCompanyName: row.ownerCompanyName || null,
    ownerCompanyEmail: row.ownerCompanyEmail || null,
    redeemerUserId: row.redeemerUserId || null,
    redeemerEmail: row.redeemerEmail || null,
    redeemerName: row.redeemerName || null,
    redeemerCompanyId: row.redeemerCompanyId || null,
    redeemerCompanyName: row.redeemerCompanyName || null,
    couponId: row.couponId || null,
    couponCode: row.couponCode || null,
    couponStatus: row.couponStatus || null,
    redemptionId: row.redemptionId || null,
    redemptionStatus: row.redemptionStatus || null,
    sourcePaymentId: row.sourcePaymentId || null,
    sourcePaymentUid: row.sourcePaymentUid || null,
    sourcePaymentGroupUid: row.sourcePaymentGroupUid || null,
    sourcePlanName: row.sourcePlanName || null,
    sourcePlanCode: row.sourcePlanCode || null,
    sourceAmount: row.sourceAmount == null ? null : toNumber(row.sourceAmount),
    sourceCurrency: row.sourceCurrency || null,
    recipientName: getAddressValue(row.deliveryAddress, 'fullName', 'name', 'recipientName', 'recipient_name'),
    recipientPhone: getAddressValue(row.deliveryAddress, 'phone', 'phoneNumber', 'recipientPhone', 'recipient_phone'),
    address: getAddressValue(row.deliveryAddress, 'address', 'fullAddress', 'full_address', 'addressLine1', 'address_line_1', 'street'),
    city: getAddressValue(row.deliveryAddress, 'city'),
    country: getAddressValue(row.deliveryAddress, 'country'),
    zipCode: getAddressValue(row.deliveryAddress, 'zipCode', 'postalCode', 'zip_code', 'postal_code'),
    deliveryAddress: parseJsonObject(row.deliveryAddress),
    trackingNumber: row.trackingNumber || null,
    modalSeenAt: row.modalSeenAt || null,
    receivedAt: row.receivedAt || null,
    declinedAt: row.declinedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
});

const summarizeGifts = (rows) => {
    const summary = {
        total: rows.length,
        pending_address: 0,
        address_submitted: 0,
        on_the_way: 0,
        shipped: 0,
        delivered: 0,
        received: 0,
        declined: 0,
        cancelled: 0,
    };

    rows.forEach((row) => {
        const status = toApiGiftStatus(row.status);
        if (summary[status] !== undefined) summary[status] += 1;
        if (status === 'on_the_way') summary.shipped += 1;
    });

    return summary;
};

const listGifts = async (filters = {}) => {
    const { sequelize } = require('../../models');
    const page = Math.max(1, toPositiveInteger(filters.page, 1));
    const limit = Math.min(500, Math.max(1, toPositiveInteger(filters.limit, 20)));
    const exportMode = parseBoolean(filters.export);
    const search = normalize(filters.search);
    const status = normalizeGiftStatus(filters.status);
    const country = normalize(filters.country);
    const { startAt, endBefore } = getGiftDateRange(filters);
    const replacements = {};
    const where = [];

    if (status) {
        where.push('g.status = :status');
        replacements.status = status;
    }
    if (startAt) {
        where.push('g.created_at >= :startAt');
        replacements.startAt = startAt;
    }
    if (endBefore) {
        where.push('g.created_at < :endBefore');
        replacements.endBefore = endBefore;
    }
    if (country) {
        replacements.country = `%${country.toLowerCase()}%`;
        where.push("LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.country')), '')) LIKE :country");
    }
    if (search) {
        replacements.search = `%${search.toLowerCase()}%`;
        where.push(`(
            CAST(g.id AS CHAR) LIKE :search OR
            LOWER(COALESCE(ou.email, '')) LIKE :search OR
            LOWER(COALESCE(ou.name, '')) LIKE :search OR
            LOWER(COALESCE(oc.name, '')) LIKE :search OR
            LOWER(COALESCE(oc.email, '')) LIKE :search OR
            LOWER(COALESCE(ru.email, '')) LIKE :search OR
            LOWER(COALESCE(ru.name, '')) LIKE :search OR
            LOWER(COALESCE(c.code, '')) LIKE :search OR
            LOWER(COALESCE(sp.payment_uid, '')) LIKE :search OR
            LOWER(COALESCE(g.tracking_number, '')) LIKE :search OR
            LOWER(COALESCE(bp.name, '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.name')), '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.recipientName')), '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.phone')), '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.phoneNumber')), '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.city')), '')) LIKE :search OR
            LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.delivery_address, '$.country')), '')) LIKE :search
        )`);
    }

    const rows = await sequelize.query(
        `
        SELECT
            g.id,
            g.status,
            g.delivery_address AS deliveryAddress,
            g.tracking_number AS trackingNumber,
            g.modal_seen_at AS modalSeenAt,
            g.received_at AS receivedAt,
            g.declined_at AS declinedAt,
            g.created_at AS createdAt,
            g.updated_at AS updatedAt,
            c.id AS couponId,
            c.code AS couponCode,
            c.status AS couponStatus,
            c.owner_user_id AS ownerUserId,
            c.owner_company_id AS ownerCompanyId,
            ou.email AS ownerEmail,
            ou.name AS ownerName,
            oc.name AS ownerCompanyName,
            oc.email AS ownerCompanyEmail,
            cr.id AS redemptionId,
            cr.status AS redemptionStatus,
            cr.redeemer_user_id AS redeemerUserId,
            cr.redeemer_company_id AS redeemerCompanyId,
            ru.email AS redeemerEmail,
            ru.name AS redeemerName,
            rc.name AS redeemerCompanyName,
            sp.id AS sourcePaymentId,
            sp.payment_uid AS sourcePaymentUid,
            sp.payment_group_uid AS sourcePaymentGroupUid,
            sp.amount AS sourceAmount,
            sp.currency AS sourceCurrency,
            bp.name AS sourcePlanName,
            bp.code AS sourcePlanCode
        FROM gifts g
        LEFT JOIN coupons c ON c.id = g.coupon_id
        LEFT JOIN coupon_redemptions cr ON cr.id = g.coupon_redemption_id
        LEFT JOIN users ou ON ou.id = c.owner_user_id
        LEFT JOIN companies oc ON oc.id = c.owner_company_id
        LEFT JOIN users ru ON ru.id = cr.redeemer_user_id
        LEFT JOIN companies rc ON rc.id = cr.redeemer_company_id
        LEFT JOIN subscription_payments sp ON sp.id = c.source_payment_id
        LEFT JOIN billing_plans bp ON bp.id = sp.plan_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY g.created_at DESC, g.id DESC
        `,
        { replacements, type: QueryTypes.SELECT }
    );

    const serializedRows = rows.map(serializeGiftRow);
    const total = serializedRows.length;
    const pagedRows = exportMode ? serializedRows : serializedRows.slice((page - 1) * limit, page * limit);

    return {
        rows: pagedRows,
        summary: summarizeGifts(serializedRows),
        pagination: {
            total,
            page,
            limit: exportMode ? total || limit : limit,
            totalPages: exportMode ? 1 : Math.ceil(total / limit),
        },
        filters: {
            status: status ? toApiGiftStatus(status) : 'all',
            search: search || null,
            startDate: filters.startDate || null,
            endDate: filters.endDate || null,
            country: country || null,
            export: exportMode,
        },
    };
};

const getGiftHistory = async (giftId) => {
    const { GiftStatusHistory, User } = require('../../models');
    const history = await GiftStatusHistory.findAll({
        where: { gift_id: giftId },
        order: [['created_at', 'ASC'], ['id', 'ASC']],
        raw: true,
    });
    const userIds = [...new Set(history.map((row) => Number(row.changed_by_user_id)).filter((id) => Number.isInteger(id) && id > 0))];
    const users = userIds.length
        ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'name', 'email'], raw: true })
        : [];
    const userMap = new Map(users.map((user) => [Number(user.id), user]));

    return history.map((row) => {
        const changedBy = userMap.get(Number(row.changed_by_user_id));
        return {
            id: row.id,
            previousStatus: row.previous_status ? toApiGiftStatus(row.previous_status) : null,
            status: toApiGiftStatus(row.new_status),
            changedByUserId: row.changed_by_user_id || null,
            changedByName: changedBy?.name || null,
            changedByEmail: changedBy?.email || null,
            note: row.note || null,
            trackingNumber: row.tracking_number || null,
            createdAt: row.created_at || null,
        };
    });
};

const getGiftById = async (giftId) => {
    const result = await listGifts({ search: String(giftId), export: true });
    const row = result.rows.find((item) => Number(item.id) === Number(giftId));
    if (!row) {
        const err = new Error('Gift not found');
        err.statusCode = 404;
        throw err;
    }

    return {
        ...row,
        owner: {
            userId: row.ownerUserId,
            email: row.ownerEmail,
            name: row.ownerName,
            companyId: row.ownerCompanyId,
            companyName: row.ownerCompanyName,
            companyEmail: row.ownerCompanyEmail,
        },
        redeemer: {
            userId: row.redeemerUserId,
            email: row.redeemerEmail,
            name: row.redeemerName,
            companyId: row.redeemerCompanyId,
            companyName: row.redeemerCompanyName,
        },
        coupon: {
            id: row.couponId,
            code: row.couponCode,
            status: row.couponStatus,
        },
        redemption: {
            id: row.redemptionId,
            status: row.redemptionStatus,
        },
        sourcePayment: {
            id: row.sourcePaymentId,
            paymentUid: row.sourcePaymentUid,
            paymentGroupUid: row.sourcePaymentGroupUid,
            planName: row.sourcePlanName,
            planCode: row.sourcePlanCode,
            amount: row.sourceAmount,
            currency: row.sourceCurrency,
        },
        delivery: {
            recipientName: row.recipientName,
            recipientPhone: row.recipientPhone,
            address: row.address,
            city: row.city,
            country: row.country,
            zipCode: row.zipCode,
            trackingNumber: row.trackingNumber,
            raw: row.deliveryAddress,
        },
        history: await getGiftHistory(giftId),
    };
};

const updateGiftStatus = async (adminUser, giftId, data = {}) => {
    const { sequelize, Gift, GiftStatusHistory } = require('../../models');
    const nextStatus = normalizeGiftStatus(data.status);
    if (!nextStatus) {
        const err = new Error('Invalid gift status');
        err.statusCode = 400;
        throw err;
    }
    if (!['ON_THE_WAY', 'DELIVERED', 'CANCELLED'].includes(nextStatus)) {
        const err = new Error('Admin can only update gift status to shipped/on_the_way, delivered, or cancelled');
        err.statusCode = 400;
        throw err;
    }

    const trackingNumber = normalize(data.trackingNumber || data.tracking_number);
    const note = normalize(data.note);

    await sequelize.transaction(async (transaction) => {
        const gift = await Gift.findByPk(giftId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!gift) {
            const err = new Error('Gift not found');
            err.statusCode = 404;
            throw err;
        }

        const previousStatus = gift.status;
        const allowed = {
            PENDING_ADDRESS: ['CANCELLED'],
            ADDRESS_SUBMITTED: ['ON_THE_WAY', 'CANCELLED'],
            ON_THE_WAY: ['DELIVERED', 'CANCELLED'],
            DELIVERED: [],
            RECEIVED: [],
            DECLINED: [],
            CANCELLED: [],
        };
        const isSameStatusTrackingUpdate = nextStatus === previousStatus && (trackingNumber || note);
        if (!isSameStatusTrackingUpdate && !allowed[previousStatus]?.includes(nextStatus)) {
            const err = new Error(`Cannot change gift status from ${previousStatus} to ${nextStatus}`);
            err.statusCode = 400;
            throw err;
        }

        const updates = {};
        if (trackingNumber) updates.tracking_number = trackingNumber;
        if (nextStatus === 'DELIVERED') updates.status = 'DELIVERED';
        else if (nextStatus === 'CANCELLED') updates.status = 'CANCELLED';
        else if (nextStatus === 'ON_THE_WAY') updates.status = 'ON_THE_WAY';

        await gift.update(updates, { transaction });
        await GiftStatusHistory.create({
            gift_id: gift.id,
            previous_status: previousStatus,
            new_status: updates.status || previousStatus,
            changed_by_user_id: adminUser.userId,
            note: note || null,
            tracking_number: trackingNumber || null,
        }, { transaction });
    });

    return getGiftById(giftId);
};

module.exports = {
    listPlatformStoreUsers,
    listPlatformTransactions,
    listShippingWalletPayments,
    listGifts,
    getGiftById,
    updateGiftStatus,
};
