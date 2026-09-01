'use strict';

const { Op, UniqueConstraintError } = require('sequelize');

const VALID_PLATFORMS = ['shopee', 'tiktok'];
const VALID_ACTOR_TYPES = ['USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM'];
const REGION_TIMEZONES = {
    BD: 'Asia/Dhaka',
    BN: 'Asia/Brunei',
    CN: 'Asia/Shanghai',
    HK: 'Asia/Hong_Kong',
    ID: 'Asia/Jakarta',
    KH: 'Asia/Phnom_Penh',
    LA: 'Asia/Vientiane',
    MM: 'Asia/Yangon',
    MO: 'Asia/Macau',
    MY: 'Asia/Kuala_Lumpur',
    PH: 'Asia/Manila',
    SG: 'Asia/Singapore',
    TH: 'Asia/Bangkok',
    TW: 'Asia/Taipei',
    VN: 'Asia/Ho_Chi_Minh',
};
const REGION_ALIASES = {
    BANGLADESH: 'BD',
    BRUNEI: 'BN',
    CAMBODIA: 'KH',
    CHINA: 'CN',
    HONGKONG: 'HK',
    'HONG KONG': 'HK',
    INDONESIA: 'ID',
    LAOS: 'LA',
    MACAU: 'MO',
    MALAYSIA: 'MY',
    MYANMAR: 'MM',
    PHILIPPINES: 'PH',
    SINGAPORE: 'SG',
    THAILAND: 'TH',
    TAIWAN: 'TW',
    VIETNAM: 'VN',
};

const normalizeString = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
};

const normalizePlatform = (value) => normalizeString(value)?.toLowerCase();

const normalizeActorType = (value) => {
    const actorType = normalizeString(value)?.toUpperCase();
    return VALID_ACTOR_TYPES.includes(actorType) ? actorType : 'SYSTEM';
};

const resolvePlatformRegion = (...values) => {
    for (const value of values) {
        const raw = normalizeString(value);
        if (!raw || raw === '-') continue;

        const upper = raw.toUpperCase();
        const compact = upper.replace(/[^A-Z]/g, '');
        const code = REGION_TIMEZONES[upper] ? upper : REGION_ALIASES[upper] || REGION_ALIASES[compact];
        if (code && REGION_TIMEZONES[code]) return code;
    }

    return null;
};

const resolvePlatformTimezone = (timezone, region) => {
    const supplied = normalizeString(timezone);
    if (supplied) {
        try {
            new Intl.DateTimeFormat('en-GB', { timeZone: supplied }).format(new Date());
            return supplied;
        } catch {
            // invalid timezone falls back to region mapping
        }
    }

    return REGION_TIMEZONES[region] || null;
};

const toPlatformLocalDateTime = (value, timeZone) => {
    if (!value || !timeZone) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const resolveCompanyId = (user, suppliedCompanyId) => {
    const tokenCompanyId = Number(user?.companyId);
    if (Number.isInteger(tokenCompanyId) && tokenCompanyId > 0) return tokenCompanyId;

    const companyId = Number(suppliedCompanyId);
    if (Number.isInteger(companyId) && companyId > 0) return companyId;

    const err = new Error('companyId is required');
    err.statusCode = 400;
    throw err;
};

const eventTitle = (eventType, fallbackTitle) => {
    const supplied = normalizeString(fallbackTitle);
    if (supplied) return supplied;

    const normalized = normalizeString(eventType) || 'ORDER_ACTIVITY';
    return normalized
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
};

const serializeLog = (row) => {
    const plain = row?.get ? row.get({ plain: true }) : row;
    return {
        id: plain.id,
        companyId: plain.company_id,
        platform: plain.platform,
        platformStoreId: plain.platform_store_id,
        storeId: plain.store_id,
        storeName: plain.store_name,
        platformOrderId: plain.platform_order_id,
        platformOrderItemId: plain.platform_order_item_id,
        packageNumber: plain.package_number,
        trackingNumber: plain.tracking_number,
        eventType: plain.event_type,
        title: plain.title,
        message: plain.message,
        oldStatus: plain.old_status,
        newStatus: plain.new_status,
        actorType: plain.actor_type,
        actorId: plain.actor_id,
        actorName: plain.actor_name,
        source: plain.source,
        sourceEventId: plain.source_event_id,
        platformRegion: plain.platform_region,
        platformTimezone: plain.platform_timezone,
        platformLocalOccurredAt: plain.platform_local_occurred_at,
        metadata: plain.metadata || {},
        occurredAt: plain.occurred_at,
        createdAt: plain.created_at,
    };
};

const findPlatformStore = async ({ companyId, platform, platformStoreId, storeId, shopId, openId, cipherId }) => {
    const { PlatformStore } = require('../../models');
    const numericStoreId = Number(platformStoreId);

    if (Number.isInteger(numericStoreId) && numericStoreId > 0) {
        return PlatformStore.findOne({
            where: { id: numericStoreId, company_id: companyId, platform, is_active: true },
            attributes: ['id', 'store_name', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher', 'region'],
        });
    }

    const filters = [];
    [storeId, shopId].map(normalizeString).filter(Boolean).forEach((value) => {
        filters.push({ external_store_id: value }, { store_shop_id: value });
    });
    const normalizedOpenId = normalizeString(openId);
    const normalizedCipherId = normalizeString(cipherId);
    if (normalizedOpenId) filters.push({ store_open_id: normalizedOpenId });
    if (normalizedCipherId) filters.push({ store_cipher: normalizedCipherId });

    if (!filters.length) return null;

    return PlatformStore.findOne({
        where: {
            company_id: companyId,
            platform,
            is_active: true,
            [Op.or]: filters,
        },
        attributes: ['id', 'store_name', 'external_store_id', 'store_shop_id', 'store_open_id', 'store_cipher', 'region'],
    });
};

const buildLogValues = async (payload = {}, user = {}) => {
    const platform = normalizePlatform(payload.platform);
    if (!VALID_PLATFORMS.includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }

    const companyId = resolveCompanyId(user, payload.companyId || payload.company_id);
    const platformOrderId = normalizeString(payload.platformOrderId || payload.platform_order_id || payload.orderId || payload.orderNo);
    if (!platformOrderId) {
        const err = new Error('platformOrderId is required');
        err.statusCode = 400;
        throw err;
    }

    const store = await findPlatformStore({
        companyId,
        platform,
        platformStoreId: payload.platformStoreId || payload.platform_store_id,
        storeId: payload.storeId || payload.store_id || payload.externalStoreId || payload.external_store_id,
        shopId: payload.shopId || payload.shop_id,
        openId: payload.openId || payload.open_id,
        cipherId: payload.cipherId || payload.cipher_id,
    });

    const eventType = normalizeString(payload.eventType || payload.event_type || payload.action) || 'ORDER_ACTIVITY';
    const actorType = normalizeActorType(payload.actorType || payload.actor_type || user.actorType);
    const source = normalizeString(payload.source) || (actorType === 'WEBHOOK' ? `${platform.toUpperCase()}_WEBHOOK` : actorType);
    const sourceEventId = normalizeString(payload.sourceEventId || payload.source_event_id || payload.eventId || payload.event_id);
    const occurredAt = payload.occurredAt || payload.occurred_at || payload.platformOccurredAt || new Date();
    const platformRegion = resolvePlatformRegion(
        payload.platformRegion,
        payload.platform_region,
        payload.region,
        payload.country,
        payload.marketplaceCountry,
        payload.marketplace_country,
        store?.region
    );
    const platformTimezone = resolvePlatformTimezone(
        payload.platformTimezone || payload.platform_timezone || payload.timezone,
        platformRegion
    );
    const platformLocalOccurredAt = normalizeString(
        payload.platformLocalOccurredAt || payload.platform_local_occurred_at
    ) || toPlatformLocalDateTime(occurredAt, platformTimezone);

    return {
        company_id: companyId,
        platform,
        platform_store_id: store?.id || payload.platformStoreId || payload.platform_store_id || null,
        store_id: normalizeString(payload.storeId || payload.store_id || payload.externalStoreId || payload.external_store_id || store?.external_store_id || store?.store_shop_id),
        store_name: normalizeString(payload.storeName || payload.store_name || store?.store_name),
        platform_order_id: platformOrderId,
        platform_order_item_id: normalizeString(payload.platformOrderItemId || payload.platform_order_item_id || payload.orderItemId),
        package_number: normalizeString(payload.packageNumber || payload.package_number || payload.packageId),
        tracking_number: normalizeString(payload.trackingNumber || payload.tracking_number || payload.awbNumber),
        event_type: eventType,
        title: eventTitle(eventType, payload.title),
        message: normalizeString(payload.message || payload.note),
        old_status: normalizeString(payload.oldStatus || payload.old_status || payload.fromStatus),
        new_status: normalizeString(payload.newStatus || payload.new_status || payload.toStatus || payload.status),
        actor_type: actorType,
        actor_id: Number(user.userId || payload.actorId || payload.actor_id) || null,
        actor_name: normalizeString(payload.actorName || payload.actor_name || user.name || user.email),
        source,
        source_event_id: sourceEventId,
        platform_region: platformRegion,
        platform_timezone: platformTimezone,
        platform_local_occurred_at: platformLocalOccurredAt,
        metadata: payload.metadata || {},
        occurred_at: occurredAt,
    };
};

const createActivityLog = async (payload = {}, user = {}) => {
    const { PlatformOrderActivityLog } = require('../../models');
    const values = await buildLogValues(payload, user);

    try {
        const row = await PlatformOrderActivityLog.create(values);
        return serializeLog(row);
    } catch (err) {
        if (err instanceof UniqueConstraintError && values.source_event_id) {
            const existing = await PlatformOrderActivityLog.findOne({
                where: {
                    company_id: values.company_id,
                    platform: values.platform,
                    source_event_id: values.source_event_id,
                },
            });
            if (existing) return { ...serializeLog(existing), duplicate: true };
        }
        throw err;
    }
};

const createManyActivityLogs = async (payloads = [], user = {}) => {
    const rows = [];
    for (const payload of payloads) {
        rows.push(await createActivityLog(payload, user));
    }
    return rows;
};

const safeCreateActivityLog = async (payload = {}, user = {}) => {
    try {
        return await createActivityLog(payload, user);
    } catch (err) {
        console.error('[order-activity-log] failed:', err.message);
        return null;
    }
};

const listActivityLogs = async (user, query = {}) => {
    const { PlatformOrderActivityLog } = require('../../models');
    const companyId = resolveCompanyId(user, query.companyId || query.company_id);
    const platform = normalizePlatform(query.platform);
    const platformOrderId = normalizeString(query.platformOrderId || query.platform_order_id || query.orderId || query.orderNo);

    if (!VALID_PLATFORMS.includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }
    if (!platformOrderId) {
        const err = new Error('platformOrderId is required');
        err.statusCode = 400;
        throw err;
    }

    const rows = await PlatformOrderActivityLog.findAll({
        where: {
            company_id: companyId,
            platform,
            platform_order_id: platformOrderId,
        },
        order: [['occurred_at', 'ASC'], ['id', 'ASC']],
    });

    return rows.map(serializeLog);
};

module.exports = {
    createActivityLog,
    createManyActivityLogs,
    safeCreateActivityLog,
    listActivityLogs,
};
