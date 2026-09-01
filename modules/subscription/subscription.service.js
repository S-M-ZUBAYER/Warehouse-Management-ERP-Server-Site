'use strict';

const crypto = require('crypto');
const Stripe = require('stripe');
const { Op, UniqueConstraintError } = require('sequelize');
const { sequelize } = require('../../config/database');
const { assertStorePermission } = require('../../utils/permissions');

const SUPPORTED_CURRENCIES = ['USD', 'CNY', 'SGD', 'MYR', 'THB', 'PHP', 'IDR', 'VND'];
const DEFAULT_COUNTRY = 'US';
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_CURRENCY = 'USD';
const PAID_STATUS = 'succeeded';
const CHECKOUT_TYPE = 'erp_store_subscription';
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
    'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
let stripeClient;

const normalize = (value) => String(value || '').trim();
const lower = (value) => normalize(value).toLowerCase();
const upper = (value) => normalize(value).toUpperCase();
const toNumber = (value) => Number(Number(value || 0).toFixed(2));
const toPositiveInteger = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
};
const getModelValue = (row, key) => {
    if (!row) return null;
    if (row[key] !== undefined && row[key] !== null && normalize(row[key]) !== '') return row[key];
    if (row.dataValues?.[key] !== undefined && row.dataValues[key] !== null && normalize(row.dataValues[key]) !== '') {
        return row.dataValues[key];
    }
    if (typeof row.get === 'function') {
        const value = row.get(key);
        if (value !== undefined && value !== null && normalize(value) !== '') return value;
    }
    return null;
};
const getFirstModelValue = (row, keys) => {
    for (const key of keys) {
        const value = getModelValue(row, key);
        if (value !== null) return value;
    }
    return null;
};
const parseJsonObject = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
};

const makePaymentUid = () => `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const makeGroupUid = () => `PGRP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const throwHttp = (message, statusCode = 400) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    throw err;
};

const getStripeClient = () => {
    const secretKey = normalize(process.env.STRIPE_SECRET_KEY);
    if (!secretKey) throwHttp('Stripe payment is not configured. Please add STRIPE_SECRET_KEY on the server.', 503);
    if (secretKey.startsWith('pk_')) throwHttp('Stripe secret key is invalid. Please use the Stripe secret key that starts with sk_ on the server.', 503);
    if (!stripeClient) stripeClient = new Stripe(secretKey);
    return stripeClient;
};

const normalizeStripeError = (error) => {
    if (!error || !String(error.type || '').startsWith('Stripe')) return error;
    const err = new Error(error.message || 'Stripe payment request failed');
    err.statusCode = error.statusCode || (['StripeAuthenticationError', 'StripeConnectionError'].includes(error.type) ? 503 : 400);
    return err;
};

const getFrontendBaseUrl = () => {
    const allowedOrigin = normalize(process.env.ALLOWED_ORIGINS).split(',').map((item) => item.trim()).filter(Boolean)[0];
    const baseUrl = normalize(process.env.FRONTEND_URL || process.env.CLIENT_APP_URL || allowedOrigin || 'http://localhost:5173');
    return baseUrl.replace(/\/+$/, '');
};

const getStripeSuccessUrl = () => `${getFrontendBaseUrl()}/warehouse_management/pricing/success?session_id={CHECKOUT_SESSION_ID}`;
const getStripeCancelUrl = () => `${getFrontendBaseUrl()}/warehouse_management/pricing/checkout?stripe_cancelled=1`;

const toStripeMinorUnit = (amount, currency) => {
    const roundedAmount = toNumber(amount);
    return STRIPE_ZERO_DECIMAL_CURRENCIES.has(upper(currency))
        ? Math.round(roundedAmount)
        : Math.round(roundedAmount * 100);
};

const makeStripePaymentUid = (session, index) => {
    const intentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    const base = normalize(intentId || session.id || makePaymentUid());
    const suffix = `-${index + 1}`;
    return `${base.slice(0, 80 - suffix.length)}${suffix}`;
};

const normalizeStoreIdentity = (store) => {
    const companyId = toPositiveInteger(getFirstModelValue(store, ['company_id', 'companyId']));
    const platform = lower(getModelValue(store, 'platform'));
    const country = upper(getFirstModelValue(store, ['region', 'marketplace_country']) || 'GLOBAL');
    const externalShopId = normalize(
        getFirstModelValue(store, [
            'store_shop_id',
            'external_store_id',
            'store_open_id',
            'store_cipher',
            'id',
        ]),
    );

    return {
        companyId,
        platform,
        marketplaceCountry: country,
        externalShopId,
        legacyCanonicalKey: `${platform}:${country}:${externalShopId}`,
        canonicalKey: `${companyId || 'company'}:${platform}:${country}:${externalShopId}`,
    };
};

const getStoreIdentityWhere = (identity) => ({
    canonical_key: identity.canonicalKey,
});

const serializePlan = (plan, { language = DEFAULT_LANGUAGE, country = DEFAULT_COUNTRY, currency = DEFAULT_CURRENCY } = {}) => {
    const translations = plan.translations || [];
    const features = plan.features || [];
    const prices = plan.prices || [];
    const languageKey = lower(language || DEFAULT_LANGUAGE);
    const baseLanguageKey = languageKey.split(/[-_]/)[0] || DEFAULT_LANGUAGE;
    const selectedTranslation =
        translations.find((item) => lower(item.language) === languageKey) ||
        translations.find((item) => lower(item.language) === baseLanguageKey) ||
        translations.find((item) => lower(item.language) === DEFAULT_LANGUAGE);
    const selectedPrice =
        prices.find((item) => upper(item.country) === upper(country) && upper(item.currency) === upper(currency) && item.is_available) ||
        prices.find((item) => upper(item.currency) === upper(currency) && item.is_available) ||
        prices.find((item) => upper(item.currency) === DEFAULT_CURRENCY && item.is_available) ||
        prices.find((item) => item.is_available);

    return {
        id: plan.id,
        name: selectedTranslation?.display_name || plan.name,
        code: plan.code,
        active: Boolean(plan.is_active),
        sortOrder: plan.sort_order,
        durationDays: plan.duration_days,
        isTrial: Boolean(plan.is_trial),
        badgeLabel: plan.badge_label,
        currency: selectedPrice?.currency || currency,
        country: selectedPrice?.country || country,
        amount: toNumber(selectedPrice?.amount),
        compareAmount: selectedPrice?.compare_amount == null ? null : toNumber(selectedPrice.compare_amount),
        features: features
            .filter((item) => item.is_active)
            .sort((a, b) => Number(a.serial_no) - Number(b.serial_no))
            .map((item) => {
                const featureTranslations = parseJsonObject(item.translations);
                const translated =
                    featureTranslations?.[languageKey] ||
                    featureTranslations?.[baseLanguageKey] ||
                    featureTranslations?.[DEFAULT_LANGUAGE];
                return {
                    id: item.id,
                    serialNo: item.serial_no,
                    key: item.feature_key,
                    title: translated?.title || item.title,
                    description: translated?.description || item.description,
                };
            }),
    };
};

const getPlanRows = async (where = { is_active: true }) => {
    const { BillingPlan, BillingPlanTranslation, BillingPlanFeature, BillingPlanPrice } = require('../../models');
    return BillingPlan.findAll({
        where,
        include: [
            { model: BillingPlanTranslation, as: 'translations', required: false },
            { model: BillingPlanFeature, as: 'features', required: false },
            { model: BillingPlanPrice, as: 'prices', required: false },
        ],
        order: [
            ['sort_order', 'ASC'],
            [{ model: BillingPlanFeature, as: 'features' }, 'serial_no', 'ASC'],
        ],
    });
};

const getPricing = async ({ country = DEFAULT_COUNTRY, language = DEFAULT_LANGUAGE, currency = DEFAULT_CURRENCY } = {}) => {
    const safeCurrency = SUPPORTED_CURRENCIES.includes(upper(currency)) ? upper(currency) : DEFAULT_CURRENCY;
    const safeCountry = upper(country || DEFAULT_COUNTRY).slice(0, 2);
    const safeLanguage = lower(language || DEFAULT_LANGUAGE).slice(0, 10);
    const plans = await getPlanRows();
    const serializedPlans = plans.map((plan) => serializePlan(plan, {
        country: safeCountry,
        language: safeLanguage,
        currency: safeCurrency,
    }));

    return {
        country: safeCountry,
        language: safeLanguage,
        currency: safeCurrency,
        plans: serializedPlans.filter((plan) => plan.code !== 'free'),
        freePlan: serializedPlans.find((plan) => plan.code === 'free') || null,
        supportedCurrencies: SUPPORTED_CURRENCIES,
    };
};

const listAdminPlans = async () => getPlanRows({});

const upsertPlan = async (data, planId = null) => {
    const { BillingPlan } = require('../../models');
    const values = {
        name: normalize(data.name),
        code: lower(data.code),
        is_active: data.isActive !== undefined ? Boolean(data.isActive) : true,
        sort_order: Number(data.sortOrder || data.sort_order || 0),
        duration_days: Number(data.durationDays || data.duration_days || 0),
        is_trial: Boolean(data.isTrial || data.is_trial),
        badge_label: data.badgeLabel || data.badge_label || null,
        metadata: data.metadata || null,
    };

    if (planId) {
        const plan = await BillingPlan.findByPk(planId);
        if (!plan) {
            const err = new Error('Plan not found');
            err.statusCode = 404;
            throw err;
        }
        await plan.update(values);
        return plan.reload();
    }

    return BillingPlan.create(values);
};

const upsertPlanFeature = async (planId, data) => {
    const { BillingPlan, BillingPlanFeature } = require('../../models');
    const plan = await BillingPlan.findByPk(planId);
    if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
    }

    const featureKey = lower(data.featureKey || data.feature_key || data.title);
    const [feature] = await BillingPlanFeature.findOrCreate({
        where: { plan_id: planId, feature_key: featureKey },
        defaults: {
            plan_id: planId,
            feature_key: featureKey,
            serial_no: Number(data.serialNo || data.serial_no || 1),
            title: normalize(data.title),
            description: data.description || null,
            translations: data.translations || null,
            is_active: data.isActive !== undefined ? Boolean(data.isActive) : true,
        },
    });
    await feature.update({
        serial_no: Number(data.serialNo || data.serial_no || feature.serial_no),
        title: normalize(data.title || feature.title),
        description: data.description !== undefined ? data.description : feature.description,
        translations: data.translations !== undefined ? data.translations : feature.translations,
        is_active: data.isActive !== undefined ? Boolean(data.isActive) : feature.is_active,
    });
    return feature;
};

const removePlanFeature = async (planId, featureId) => {
    const { BillingPlanFeature } = require('../../models');
    const deleted = await BillingPlanFeature.destroy({ where: { id: featureId, plan_id: planId } });
    if (!deleted) {
        const err = new Error('Plan feature not found');
        err.statusCode = 404;
        throw err;
    }
};

const upsertPlanTranslation = async (planId, data) => {
    const { BillingPlan, BillingPlanTranslation } = require('../../models');
    const plan = await BillingPlan.findByPk(planId);
    if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
    }
    const language = lower(data.language || DEFAULT_LANGUAGE);
    const [translation] = await BillingPlanTranslation.findOrCreate({
        where: { plan_id: planId, language },
        defaults: {
            plan_id: planId,
            language,
            display_name: normalize(data.displayName || data.display_name || plan.name),
            description: data.description || null,
        },
    });
    await translation.update({
        display_name: normalize(data.displayName || data.display_name || translation.display_name),
        description: data.description !== undefined ? data.description : translation.description,
    });
    return translation;
};

const upsertPlanPrice = async (planId, data) => {
    const { BillingPlan, BillingPlanPrice } = require('../../models');
    const plan = await BillingPlan.findByPk(planId);
    if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
    }
    const country = upper(data.country || DEFAULT_COUNTRY).slice(0, 2);
    const currency = upper(data.currency || DEFAULT_CURRENCY);
    const [price] = await BillingPlanPrice.findOrCreate({
        where: { plan_id: planId, country, currency },
        defaults: {
            plan_id: planId,
            country,
            currency,
            amount: toNumber(data.amount),
            compare_amount: data.compareAmount ?? data.compare_amount ?? null,
            is_available: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
        },
    });
    await price.update({
        amount: toNumber(data.amount ?? price.amount),
        compare_amount: data.compareAmount ?? data.compare_amount ?? price.compare_amount,
        is_available: data.isAvailable !== undefined ? Boolean(data.isAvailable) : price.is_available,
    });
    return price;
};

const getPlanForCheckout = async ({ planCode, planName, country, currency }) => {
    const where = { is_active: true, is_trial: false };
    if (planCode) where.code = lower(planCode);
    else where.name = normalize(planName);

    const plan = (await getPlanRows(where))[0];
    if (!plan) {
        const err = new Error('Selected plan is not available');
        err.statusCode = 400;
        throw err;
    }

    const serialized = serializePlan(plan, { country, currency });
    if (!serialized.amount || serialized.amount <= 0) {
        const err = new Error('Selected plan does not have an active paid price for this currency');
        err.statusCode = 400;
        throw err;
    }
    return { row: plan, price: serialized };
};

const resolvePlatformStores = async (user, data, transaction) => {
    const { PlatformStore } = require('../../models');
    const ids = [
        ...(Array.isArray(data.storeIds) ? data.storeIds : []),
        ...(Array.isArray(data.platformStoreIds) ? data.platformStoreIds : []),
        ...(Array.isArray(data.stores) ? data.stores.map((item) => item?.id || item?.storeId || item?.platformStoreId).filter(Boolean) : []),
    ].map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);

    const where = { company_id: user.companyId, deleted_at: null };
    if (ids.length) {
        where.id = { [Op.in]: [...new Set(ids)] };
    } else {
        const labels = (Array.isArray(data.stores) ? data.stores : [])
            .map((item) => normalize(item?.label || item?.storeName || item))
            .filter(Boolean);
        const platforms = (Array.isArray(data.platform) ? data.platform : [])
            .map((item) => lower(item))
            .filter(Boolean);

        if (labels.length) {
            where[Op.or] = [
                { store_name: { [Op.in]: labels } },
                { external_store_name: { [Op.in]: labels } },
            ];
        }
        if (platforms.length) where.platform = { [Op.in]: platforms };
    }

    const stores = await PlatformStore.findAll({ where, transaction });
    if (!stores.length) {
        const err = new Error('No authorized platform store found for this checkout');
        err.statusCode = 400;
        throw err;
    }

    for (const store of stores) {
        await assertStorePermission(user, store.id);
    }

    return stores;
};

const findPaidStoreSubscriptionByIdentity = async (identity, transaction) => {
    const { StoreSubscription, SubscriptionPayment } = require('../../models');
    const subscriptions = await StoreSubscription.findAll({
        where: getStoreIdentityWhere(identity),
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });
    const subscriptionIds = subscriptions
        .map((subscription) => Number(subscription.id))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (!subscriptionIds.length) return null;

    const payments = await SubscriptionPayment.findAll({
        attributes: ['store_subscription_id', 'new_expiry', 'paid_at'],
        where: {
            store_subscription_id: { [Op.in]: subscriptionIds },
            purchaser_company_id: identity.companyId,
            payment_status: PAID_STATUS,
        },
        order: [
            ['new_expiry', 'DESC'],
            ['paid_at', 'DESC'],
        ],
        transaction,
    });

    const paidIds = new Set(payments.map((payment) => Number(payment.store_subscription_id)));
    if (!paidIds.size) return null;

    const paidSubscriptions = subscriptions.filter((subscription) => paidIds.has(Number(subscription.id)));
    const now = new Date();
    paidSubscriptions.sort((left, right) => {
        const leftExpiry = left.expires_at ? new Date(left.expires_at).getTime() : 0;
        const rightExpiry = right.expires_at ? new Date(right.expires_at).getTime() : 0;
        const leftActive = leftExpiry > now.getTime() ? 1 : 0;
        const rightActive = rightExpiry > now.getTime() ? 1 : 0;
        return rightActive - leftActive || rightExpiry - leftExpiry || Number(right.id) - Number(left.id);
    });

    return paidSubscriptions[0] || null;
};

const getLatestPaidPaymentForPlatformStore = async ({ companyId, platformStoreId, transaction }) => {
    const safeCompanyId = toPositiveInteger(companyId);
    const safePlatformStoreId = toPositiveInteger(platformStoreId);
    if (!safeCompanyId || !safePlatformStoreId) return null;

    const { SubscriptionPayment } = require('../../models');
    return SubscriptionPayment.findOne({
        where: {
            purchaser_company_id: safeCompanyId,
            platform_store_id: safePlatformStoreId,
            payment_status: PAID_STATUS,
        },
        order: [
            ['new_expiry', 'DESC'],
            ['paid_at', 'DESC'],
            ['id', 'DESC'],
        ],
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });
};

const getLatestPaidPaymentForSubscriptionCompany = async ({ companyId, subscriptionId, transaction }) => {
    const safeCompanyId = toPositiveInteger(companyId);
    const safeSubscriptionId = toPositiveInteger(subscriptionId);
    if (!safeCompanyId || !safeSubscriptionId) return null;

    const { SubscriptionPayment } = require('../../models');
    return SubscriptionPayment.findOne({
        where: {
            purchaser_company_id: safeCompanyId,
            store_subscription_id: safeSubscriptionId,
            payment_status: PAID_STATUS,
        },
        order: [
            ['new_expiry', 'DESC'],
            ['paid_at', 'DESC'],
            ['id', 'DESC'],
        ],
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });
};

const getMarketplaceSubscriptionIds = async ({ identity, transaction }) => {
    if (!identity?.platform || !identity?.marketplaceCountry || !identity?.externalShopId) return [];

    const { StoreSubscription } = require('../../models');
    const rows = await StoreSubscription.findAll({
        attributes: ['id'],
        where: {
            platform: identity.platform,
            marketplace_country: identity.marketplaceCountry,
            external_shop_id: identity.externalShopId,
        },
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });

    return rows
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);
};

const getLatestPaidPaymentForMarketplaceIdentity = async ({ identity, transaction }) => {
    const subscriptionIds = await getMarketplaceSubscriptionIds({ identity, transaction });
    if (!subscriptionIds.length) return null;

    const { SubscriptionPayment } = require('../../models');
    return SubscriptionPayment.findOne({
        where: {
            store_subscription_id: { [Op.in]: subscriptionIds },
            payment_status: PAID_STATUS,
        },
        order: [
            ['new_expiry', 'DESC'],
            ['paid_at', 'DESC'],
            ['id', 'DESC'],
        ],
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });
};

const syncMarketplaceSubscriptionsToPayment = async ({ identity, payment, transaction }) => {
    if (!payment) return;
    const subscriptionIds = await getMarketplaceSubscriptionIds({ identity, transaction });
    if (!subscriptionIds.length) return;

    const { StoreSubscription } = require('../../models');
    const expiresAt = payment.new_expiry;
    const status = expiresAt && new Date(expiresAt) > new Date() ? 'active' : 'expired';
    await StoreSubscription.update(
        {
            current_plan_id: payment.plan_id,
            status,
            expires_at: expiresAt,
        },
        {
            where: { id: { [Op.in]: subscriptionIds } },
            transaction,
        }
    );
};

const syncSubscriptionToOwnedPayment = async ({ subscription, store, identity, freePlan, transaction }) => {
    const { SubscriptionPayment } = require('../../models');
    const companyId = toPositiveInteger(identity.companyId);
    const platformStoreId = toPositiveInteger(getModelValue(store, 'id'));
    if (!subscription || !companyId) return subscription;

    const latestStorePayment = await getLatestPaidPaymentForPlatformStore({
        companyId,
        platformStoreId,
        transaction,
    });
    const latestCompanySubscriptionPayment = latestStorePayment || (!platformStoreId ? await getLatestPaidPaymentForSubscriptionCompany({
        companyId,
        subscriptionId: subscription.id,
        transaction,
    }) : null);
    const latestMarketplacePayment = await getLatestPaidPaymentForMarketplaceIdentity({
        identity,
        transaction,
    });
    const latestEffectivePayment = latestMarketplacePayment || latestCompanySubscriptionPayment;

    if (latestEffectivePayment) {
        if (
            latestCompanySubscriptionPayment &&
            platformStoreId &&
            Number(latestCompanySubscriptionPayment.platform_store_id) === platformStoreId &&
            Number(latestCompanySubscriptionPayment.store_subscription_id) !== Number(subscription.id)
        ) {
            await SubscriptionPayment.update(
                { store_subscription_id: subscription.id },
                {
                    where: {
                        purchaser_company_id: companyId,
                        platform_store_id: platformStoreId,
                        payment_status: PAID_STATUS,
                    },
                    transaction,
                }
            );
        }

        const expiresAt = latestEffectivePayment.new_expiry || subscription.expires_at;
        const status = expiresAt && new Date(expiresAt) > new Date() ? 'active' : 'expired';
        await subscription.update({
            current_plan_id: latestEffectivePayment.plan_id,
            status,
            expires_at: expiresAt,
        }, { transaction });
        return subscription;
    }

    const otherCompanyPaymentCount = await SubscriptionPayment.count({
        where: {
            store_subscription_id: subscription.id,
            purchaser_company_id: { [Op.ne]: companyId },
            payment_status: PAID_STATUS,
        },
        transaction,
    });

    const metadata = subscription.metadata || {};
    const shouldResetToFreePlan = freePlan && (
        otherCompanyPaymentCount > 0 ||
        Boolean(metadata.migratedFromLegacyCanonicalKey)
    );

    if (shouldResetToFreePlan) {
        const trialStartedAt = subscription.trial_started_at || new Date();
        const expiresAt = addDays(trialStartedAt, freePlan.duration_days);
        const status = expiresAt > new Date() ? 'trial' : 'expired';
        await subscription.update({
            current_plan_id: freePlan.id,
            status,
            trial_started_at: trialStartedAt,
            trial_used: true,
            expires_at: expiresAt,
        }, { transaction });
    }

    return subscription;
};

const ensureStoreSubscription = async (store, transaction) => {
    const { BillingPlan, StoreSubscription, SubscriptionPayment } = require('../../models');
    const identity = normalizeStoreIdentity(store);
    if (!identity.companyId) throwHttp('Store company identity is missing for subscription lookup', 500);
    const platformStoreId = toPositiveInteger(getModelValue(store, 'id'));
    const now = new Date();
    const freePlan = await BillingPlan.findOne({
        where: { code: 'free', is_active: true },
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });

    let subscription = await findPaidStoreSubscriptionByIdentity(identity, transaction);

    if (!subscription) {
        subscription = await StoreSubscription.findOne({
            where: { canonical_key: identity.canonicalKey },
            transaction,
            lock: transaction?.LOCK?.UPDATE,
        });
    }

    let created = false;
    let separatedLegacyState = null;

    if (!subscription) {
        const legacySubscription = await StoreSubscription.findOne({
            where: { canonical_key: identity.legacyCanonicalKey },
            transaction,
            lock: transaction?.LOCK?.UPDATE,
        });
        if (legacySubscription) {
            const legacyMetadata = legacySubscription.metadata || {};
            const legacyPlatformStoreId = Number(legacyMetadata.firstPlatformStoreId);
            const companyPaymentCount = await SubscriptionPayment.count({
                where: {
                    store_subscription_id: legacySubscription.id,
                    purchaser_company_id: identity.companyId,
                    payment_status: PAID_STATUS,
                },
                transaction,
            });
            const currentStorePaymentCount = platformStoreId ? await SubscriptionPayment.count({
                where: {
                    store_subscription_id: legacySubscription.id,
                    purchaser_company_id: identity.companyId,
                    platform_store_id: platformStoreId,
                    payment_status: PAID_STATUS,
                },
                transaction,
            }) : 0;
            const otherCompanyPaymentCount = await SubscriptionPayment.count({
                where: {
                    store_subscription_id: legacySubscription.id,
                    purchaser_company_id: { [Op.ne]: identity.companyId },
                    payment_status: PAID_STATUS,
                },
                transaction,
            });
            const belongsToCurrentCompany =
                (platformStoreId && legacyPlatformStoreId === Number(platformStoreId)) ||
                currentStorePaymentCount > 0 ||
                companyPaymentCount > 0;

            if (belongsToCurrentCompany && otherCompanyPaymentCount === 0) {
                try {
                    await legacySubscription.update({
                        canonical_key: identity.canonicalKey,
                        metadata: {
                            ...legacyMetadata,
                            migratedFromLegacyCanonicalKey: identity.legacyCanonicalKey,
                            firstPlatformStoreId: legacyMetadata.firstPlatformStoreId || platformStoreId,
                            firstCompanyId: legacyMetadata.firstCompanyId || identity.companyId,
                        },
                    }, { transaction });
                    subscription = legacySubscription;
                } catch (err) {
                    if (!(err instanceof UniqueConstraintError)) throw err;
                }
            } else if (belongsToCurrentCompany && companyPaymentCount > 0) {
                const latestCompanyPayment = await SubscriptionPayment.findOne({
                    where: {
                        store_subscription_id: legacySubscription.id,
                        purchaser_company_id: identity.companyId,
                        payment_status: PAID_STATUS,
                    },
                    order: [
                        ['new_expiry', 'DESC'],
                        ['paid_at', 'DESC'],
                    ],
                    transaction,
                });
                if (latestCompanyPayment) {
                    separatedLegacyState = {
                        currentPlanId: latestCompanyPayment.plan_id,
                        expiresAt: latestCompanyPayment.new_expiry,
                        status: latestCompanyPayment.new_expiry && new Date(latestCompanyPayment.new_expiry) > now ? 'active' : 'expired',
                    };
                }
            }
        }
    }

    if (!subscription) {
        const initialExpiresAt = separatedLegacyState?.expiresAt || (freePlan ? addDays(now, freePlan.duration_days) : now);
        [subscription, created] = await StoreSubscription.findOrCreate({
            where: { canonical_key: identity.canonicalKey },
            defaults: {
                canonical_key: identity.canonicalKey,
                platform: identity.platform,
                marketplace_country: identity.marketplaceCountry,
                external_shop_id: identity.externalShopId,
                current_plan_id: separatedLegacyState?.currentPlanId || freePlan?.id || null,
                status: separatedLegacyState?.status || 'trial',
                trial_started_at: separatedLegacyState ? null : now,
                trial_used: true,
                expires_at: initialExpiresAt,
                metadata: {
                    firstPlatformStoreId: platformStoreId,
                    firstCompanyId: identity.companyId,
                    ...(separatedLegacyState ? { separatedFromLegacyCanonicalKey: identity.legacyCanonicalKey } : {}),
                },
            },
            transaction,
            lock: transaction?.LOCK?.UPDATE,
        });
    }

    await syncSubscriptionToOwnedPayment({ subscription, store, identity, freePlan, transaction });
    if (!created) {
        const status = subscription.expires_at && new Date(subscription.expires_at) > now
            ? subscription.status
            : 'expired';
        if (status !== subscription.status) {
            await subscription.update({ status }, { transaction });
        }
    }

    return subscription;
};

const getSubscriptionSnapshotForStore = async (store, transaction) => {
    const { BillingPlan, PlatformStore, StoreSubscription } = require('../../models');
    const subscription = await ensureStoreSubscription(store, transaction);
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
    const remainingDays = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000))
        : 0;
    const status = expiresAt && expiresAt > now ? subscription.status : 'expired';

    if (status !== subscription.status) {
        await subscription.update({ status }, { transaction });
    }
    if (status === 'expired' && store?.auto_order_accept) {
        if (typeof store.update === 'function') {
            await store.update({ auto_order_accept: false }, { transaction });
        } else if (store?.id) {
            await PlatformStore.update(
                { auto_order_accept: false },
                { where: { id: store.id }, transaction }
            );
        }
        if (store?.dataValues) store.dataValues.auto_order_accept = false;
        store.auto_order_accept = false;
    }

    const plan = subscription.current_plan_id
        ? await BillingPlan.findByPk(subscription.current_plan_id, {
            attributes: ['id', 'name', 'code', 'duration_days', 'is_trial'],
            transaction,
        })
        : null;

    return {
        id: subscription.id,
        canonicalKey: subscription.canonical_key,
        planId: plan?.id || null,
        planName: plan?.name || null,
        planCode: plan?.code || null,
        status,
        remainingDays,
        expiresAt: subscription.expires_at,
        trialUsed: Boolean(subscription.trial_used),
        isTrial: Boolean(plan?.is_trial || status === 'trial'),
    };
};

const isStoreSubscriptionActive = async (store, transaction) => {
    const snapshot = await getSubscriptionSnapshotForStore(store, transaction);
    return snapshot.status !== 'expired' && Number(snapshot.remainingDays || 0) > 0;
};

const assertStoreSubscriptionActive = async (store, action = 'marketplace operations', transaction) => {
    if (!store) {
        const err = new Error('Platform store not found for subscription check.');
        err.statusCode = 404;
        err.code = 'STORE_NOT_FOUND';
        throw err;
    }
    const active = await isStoreSubscriptionActive(store, transaction);
    if (active) return true;
    const err = new Error(`Subscription expired for this store. Please upgrade to continue ${action}.`);
    err.statusCode = 403;
    err.code = 'STORE_SUBSCRIPTION_EXPIRED';
    throw err;
};

const appendSubscriptionSnapshots = async (stores = []) => {
    const rows = Array.isArray(stores) ? stores : [];
    const snapshots = await Promise.all(rows.map((store) => getSubscriptionSnapshotForStore(store)));
    return rows.map((store, index) => {
        if (store?.dataValues) {
            store.dataValues.subscription = snapshots[index];
            return store;
        }
        return { ...store, subscription: snapshots[index] };
    });
};

const createUniqueCoupon = async ({ user, sourcePaymentId, transaction }) => {
    const { Coupon } = require('../../models');
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = String(crypto.randomInt(100000, 1000000));
        try {
            return await Coupon.create({
                code,
                owner_company_id: user.companyId,
                owner_user_id: user.userId,
                source_payment_id: sourcePaymentId,
                status: 'active',
                max_redemption_count: 1,
                redemption_count: 0,
            }, { transaction });
        } catch (err) {
            if (!(err instanceof UniqueConstraintError)) throw err;
        }
    }

    const err = new Error('Unable to generate a unique coupon code');
    err.statusCode = 500;
    throw err;
};

const companyHasPaidBefore = async (companyId, transaction) => {
    const { SubscriptionPayment } = require('../../models');
    const count = await SubscriptionPayment.count({
        where: { purchaser_company_id: companyId, payment_status: PAID_STATUS },
        transaction,
    });
    return count > 0;
};

const userHasPaidBefore = async (userId, transaction) => {
    const { SubscriptionPayment } = require('../../models');
    const count = await SubscriptionPayment.count({
        where: { purchaser_user_id: userId, payment_status: PAID_STATUS },
        transaction,
    });
    return count > 0;
};

const storesHavePaidBefore = async ({ companyId, subscriptionIds = [], platformStoreIds = [], transaction }) => {
    const ids = subscriptionIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    const storeIds = platformStoreIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    const ownershipChecks = storeIds.length
        ? [{ platform_store_id: { [Op.in]: storeIds } }]
        : ids.length
            ? [{ store_subscription_id: { [Op.in]: ids } }]
            : [];
    if (!ownershipChecks.length) return false;

    const { SubscriptionPayment } = require('../../models');
    const count = await SubscriptionPayment.count({
        where: {
            purchaser_company_id: companyId,
            payment_status: PAID_STATUS,
            [Op.or]: ownershipChecks,
        },
        transaction,
    });
    return count > 0;
};

const getCompanyAuthorizedStores = async (user, transaction) => {
    const { PlatformStore } = require('../../models');
    return PlatformStore.findAll({
        where: { company_id: user.companyId, deleted_at: null },
        transaction,
    });
};

const companyStoresHaveActiveMarketplacePlan = async ({ stores = [], transaction }) => {
    const identities = [];
    const seen = new Set();

    (Array.isArray(stores) ? stores : []).forEach((store) => {
        const identity = normalizeStoreIdentity(store);
        if (!identity.platform || !identity.marketplaceCountry || !identity.externalShopId) return;
        const key = `${identity.platform}:${identity.marketplaceCountry}:${identity.externalShopId}`;
        if (seen.has(key)) return;
        seen.add(key);
        identities.push(identity);
    });

    if (!identities.length) return false;

    const { BillingPlan, StoreSubscription } = require('../../models');
    const activeSubscriptions = await StoreSubscription.findAll({
        attributes: ['current_plan_id'],
        where: {
            status: 'active',
            expires_at: { [Op.gt]: new Date() },
            [Op.or]: identities.map((identity) => ({
                platform: identity.platform,
                marketplace_country: identity.marketplaceCountry,
                external_shop_id: identity.externalShopId,
            })),
        },
        transaction,
    });

    const activePlanIds = activeSubscriptions
        .map((subscription) => Number(subscription.current_plan_id))
        .filter((id) => Number.isInteger(id) && id > 0);
    if (!activePlanIds.length) return false;

    const paidPlanCount = await BillingPlan.count({
        where: {
            id: { [Op.in]: activePlanIds },
            is_trial: false,
            code: { [Op.ne]: 'free' },
        },
        transaction,
    });

    return paidPlanCount > 0;
};

const marketplaceStoresHavePaidBefore = async ({ stores = [], transaction }) => {
    const rows = Array.isArray(stores) ? stores : [];
    const identityMap = new Map();
    const companyIds = new Set();
    const platformStoreIds = new Set();

    rows.forEach((store) => {
        const identity = normalizeStoreIdentity(store);
        if (!identity.platform || !identity.externalShopId) return;
        identityMap.set(identity.canonicalKey, identity);
        if (identity.companyId) companyIds.add(Number(identity.companyId));
        const platformStoreId = toPositiveInteger(getModelValue(store, 'id'));
        if (platformStoreId) platformStoreIds.add(platformStoreId);
    });

    const { StoreSubscription, SubscriptionPayment } = require('../../models');

    if (companyIds.size && platformStoreIds.size) {
        const ownedStorePaymentCount = await SubscriptionPayment.count({
            where: {
                purchaser_company_id: { [Op.in]: [...companyIds] },
                platform_store_id: { [Op.in]: [...platformStoreIds] },
                payment_status: PAID_STATUS,
            },
            transaction,
        });
        if (ownedStorePaymentCount > 0) return true;
    }

    const identities = [...identityMap.values()];
    if (!identities.length) return false;

    const subscriptions = await StoreSubscription.findAll({
        attributes: ['id'],
        where: {
            canonical_key: { [Op.in]: identities.map((identity) => identity.canonicalKey) },
        },
        transaction,
    });

    const subscriptionIds = subscriptions
        .map((subscription) => Number(subscription.id))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (!subscriptionIds.length) return false;

    const paidCount = await SubscriptionPayment.count({
        where: {
            store_subscription_id: { [Op.in]: subscriptionIds },
            ...(companyIds.size ? { purchaser_company_id: { [Op.in]: [...companyIds] } } : {}),
            payment_status: PAID_STATUS,
        },
        transaction,
    });

    return paidCount > 0;
};

const isReferralPlanDuration = (durationDays) => [365, 730].includes(Number(durationDays || 0));

const getReferralPurchaseEligibility = async ({ user, plan, subscriptionIds = [], platformStoreIds = [], transaction }) => {
    if (!isReferralPlanDuration(plan?.duration_days)) {
        return { eligible: false, reason: 'Coupon can only be redeemed on a one-year or two-year plan' };
    }
    if (await companyHasPaidBefore(user.companyId, transaction)) {
        return { eligible: false, reason: 'Coupon can only be redeemed by a company making its first paid plan purchase' };
    }
    if (await userHasPaidBefore(user.userId, transaction)) {
        return { eligible: false, reason: 'Coupon can only be redeemed by a user making their first paid plan purchase' };
    }
    if (await storesHavePaidBefore({
        companyId: user.companyId,
        subscriptionIds,
        platformStoreIds,
        transaction,
    })) {
        return { eligible: false, reason: 'Coupon can only be redeemed for a store with no previous paid plan purchase' };
    }
    const companyStores = await getCompanyAuthorizedStores(user, transaction);
    if (await companyStoresHaveActiveMarketplacePlan({ stores: companyStores, transaction })) {
        return { eligible: false, reason: 'Coupon can only be redeemed when none of this company authorized stores already has an active paid plan' };
    }
    if (await marketplaceStoresHavePaidBefore({ stores: companyStores, transaction })) {
        return { eligible: false, reason: 'Coupon can only be redeemed when none of this company authorized stores already has a paid plan purchase' };
    }

    return { eligible: true, reason: null };
};

const validateCouponForSubscription = async ({ user, couponCode, subscriptionId, subscriptionIds = [], platformStoreIds = [], plan, transaction }) => {
    const { Coupon } = require('../../models');
    const coupon = await Coupon.findOne({
        where: { code: normalize(couponCode), status: 'active' },
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });

    if (!coupon) return { eligible: false, reason: 'Coupon is not valid or already used' };
    if (Number(coupon.owner_company_id) === Number(user.companyId)) {
        return { eligible: false, reason: 'You cannot redeem your own coupon' };
    }
    if (Number(coupon.redemption_count) >= Number(coupon.max_redemption_count)) {
        return { eligible: false, reason: 'Coupon redemption limit reached' };
    }
    const purchaseEligibility = await getReferralPurchaseEligibility({
        user,
        plan,
        subscriptionIds: subscriptionIds.length ? subscriptionIds : [subscriptionId],
        platformStoreIds,
        transaction,
    });
    if (!purchaseEligibility.eligible) return purchaseEligibility;

    return { eligible: true, coupon };
};

const createGiftForRedemption = async ({ coupon, redemption, subscriptionId, user, transaction }) => {
    const { Gift, GiftStatusHistory } = require('../../models');
    const [gift, created] = await Gift.findOrCreate({
        where: { coupon_redemption_id: redemption.id },
        defaults: {
            coupon_id: coupon.id,
            coupon_redemption_id: redemption.id,
            recipient_company_id: coupon.owner_company_id,
            recipient_user_id: coupon.owner_user_id,
            store_subscription_id: subscriptionId,
            status: 'PENDING_ADDRESS',
        },
        transaction,
    });

    if (created) {
        await GiftStatusHistory.create({
            gift_id: gift.id,
            previous_status: null,
            new_status: 'PENDING_ADDRESS',
            changed_by_user_id: user.userId,
            note: 'Gift created from eligible coupon redemption',
        }, { transaction });
    }

    return gift;
};

const applyCouponForCheckout = async ({ user, couponCode, subscription, subscriptionIds = [], platformStoreIds = [], plan, paymentGroupUid, transaction }) => {
    if (!couponCode) return null;
    const { Coupon, CouponRedemption } = require('../../models');

    const validation = await validateCouponForSubscription({
        user,
        couponCode,
        subscriptionId: subscription.id,
        subscriptionIds,
        platformStoreIds,
        plan,
        transaction,
    });
    if (!validation.eligible) {
        const err = new Error(validation.reason);
        err.statusCode = 400;
        throw err;
    }

    const coupon = validation.coupon;
    const redemption = await CouponRedemption.create({
        coupon_id: coupon.id,
        redeemer_company_id: user.companyId,
        redeemer_user_id: user.userId,
        store_subscription_id: subscription.id,
        source_payment_group_uid: paymentGroupUid,
        status: 'applied',
    }, { transaction });

    const gift = await createGiftForRedemption({
        coupon,
        redemption,
        subscriptionId: subscription.id,
        user,
        transaction,
    });

    await Coupon.update({
        status: 'redeemed',
        redemption_count: Number(coupon.redemption_count || 0) + 1,
        redeemed_at: new Date(),
        redeemed_by_company_id: user.companyId,
        redeemed_by_user_id: user.userId,
        redeemed_store_subscription_id: subscription.id,
        gift_id: gift.id,
    }, { where: { id: coupon.id }, transaction });

    return { coupon, redemption, gift };
};

const completePaidCheckout = async (user, data, options = {}) => {
    const country = upper(data.country || DEFAULT_COUNTRY).slice(0, 2);
    const currency = upper(data.currency || DEFAULT_CURRENCY);
    const paymentProvider = options.paymentProvider || 'mock';
    const { row: plan, price } = await getPlanForCheckout({
        planCode: data.planCode,
        planName: data.planName,
        country,
        currency,
    });

    return sequelize.transaction(async (transaction) => {
        const { SubscriptionPayment } = require('../../models');
        const stores = await resolvePlatformStores(user, data, transaction);
        const paymentGroupUid = options.paymentGroupUid || makeGroupUid();
        const paidAt = new Date();
        const payments = [];
        const coupons = [];
        const subscriptionPairs = [];

        for (const store of stores) {
            const subscription = await ensureStoreSubscription(store, transaction);
            subscriptionPairs.push({ store, subscription });
        }

        let couponRedemption = null;
        if (data.couponCode) {
            couponRedemption = await applyCouponForCheckout({
                user,
                couponCode: data.couponCode,
                subscription: subscriptionPairs[0].subscription,
                subscriptionIds: subscriptionPairs.map((item) => item.subscription.id),
                platformStoreIds: subscriptionPairs.map((item) => getModelValue(item.store, 'id')).filter(Boolean),
                plan,
                paymentGroupUid,
                transaction,
            });
        }

        for (const { store, subscription } of subscriptionPairs) {
            const paymentIndex = payments.length;
            const platformStoreId = toPositiveInteger(getModelValue(store, 'id'));
            const latestOwnedPayment = await getLatestPaidPaymentForPlatformStore({
                companyId: user.companyId,
                platformStoreId,
                transaction,
            });
            const previousExpirySource = latestOwnedPayment?.new_expiry || subscription.expires_at;
            const previousExpiry = previousExpirySource ? new Date(previousExpirySource) : null;
            const extensionStart = previousExpiry && previousExpiry > paidAt ? previousExpiry : paidAt;
            const newExpiry = addDays(extensionStart, plan.duration_days);

            await subscription.update({
                current_plan_id: plan.id,
                status: 'active',
                expires_at: newExpiry,
            }, { transaction });

            const payment = await SubscriptionPayment.create({
                payment_uid: options.paymentUidFactory
                    ? options.paymentUidFactory({ store, subscription, index: paymentIndex })
                    : makePaymentUid(),
                payment_group_uid: paymentGroupUid,
                store_subscription_id: subscription.id,
                platform_store_id: platformStoreId,
                purchaser_company_id: user.companyId,
                purchaser_user_id: user.userId,
                purchaser_email: user.email,
                plan_id: plan.id,
                currency: price.currency,
                amount: price.amount,
                payment_provider: paymentProvider,
                payment_status: PAID_STATUS,
                paid_at: paidAt,
                previous_expiry: previousExpiry,
                new_expiry: newExpiry,
                metadata: {
                    ...(options.metadata || {}),
                    frontendAmount: data.totalAmount,
                    frontendPlanPrice: data.planPrice,
                    selectedStoreCount: stores.length,
                    redeemedCouponCode: data.couponCode || null,
                },
            }, { transaction });

            payments.push(payment);
            await syncMarketplaceSubscriptionsToPayment({
                identity: normalizeStoreIdentity(store),
                payment,
                transaction,
            });
        }

        for (const payment of payments) {
            const coupon = await createUniqueCoupon({
                user,
                sourcePaymentId: payment.id,
                transaction,
            });
            await payment.update({ coupon_code: coupon.code }, { transaction });
            coupons.push({
                code: coupon.code,
                paymentId: payment.id,
                storeSubscriptionId: payment.store_subscription_id,
                platformStoreId: payment.platform_store_id,
            });
        }

        return {
            paymentId: paymentGroupUid,
            paymentProvider,
            paymentStatus: PAID_STATUS,
            couponCode: coupons[0]?.code || null,
            couponCodes: coupons,
            redeemedCouponCode: data.couponCode || null,
            giftCreated: Boolean(couponRedemption?.gift),
            plan: price,
            planName: plan.name,
            planCode: plan.code,
            period: `${plan.duration_days} days`,
            storeCount: stores.length,
            amount: toNumber(price.amount * stores.length),
            currency: price.currency,
            paidAt,
            payments: payments.map((payment) => ({
                id: payment.id,
                paymentUid: payment.payment_uid,
                storeSubscriptionId: payment.store_subscription_id,
                platformStoreId: payment.platform_store_id,
                amount: toNumber(payment.amount),
                previousExpiry: payment.previous_expiry,
                newExpiry: payment.new_expiry,
            })),
        };
    });
};

const completeDemoCheckout = async (user, data) => completePaidCheckout(user, data, {
    paymentProvider: 'mock',
});

const assertCouponCanBeUsedForCheckout = async (user, data, plan) => {
    if (!data.couponCode) return;

    await sequelize.transaction(async (transaction) => {
        const stores = await resolvePlatformStores(user, data, transaction);
        const subscriptions = [];
        for (const store of stores) {
            subscriptions.push(await ensureStoreSubscription(store, transaction));
        }
        const result = await validateCouponForSubscription({
            user,
            couponCode: data.couponCode,
            subscription: subscriptions[0],
            subscriptionId: subscriptions[0]?.id,
            subscriptionIds: subscriptions.map((subscription) => subscription.id),
            platformStoreIds: stores.map((store) => getModelValue(store, 'id')).filter(Boolean),
            plan,
            transaction,
        });
        if (!result.eligible) throwHttp(result.reason || 'Coupon is not eligible for this checkout', 400);
    });
};

const createStripeCheckoutSession = async (user, data) => {
    const country = upper(data.country || DEFAULT_COUNTRY).slice(0, 2);
    const currency = upper(data.currency || DEFAULT_CURRENCY);
    const { row: plan, price } = await getPlanForCheckout({
        planCode: data.planCode,
        planName: data.planName,
        country,
        currency,
    });
    const stores = await resolvePlatformStores(user, data);

    await assertCouponCanBeUsedForCheckout(user, data, plan);

    const amount = toNumber(price.amount * stores.length);
    let session;
    try {
        const stripe = getStripeClient();
        session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: user.email || undefined,
            client_reference_id: `${user.companyId}:${user.userId}:${Date.now()}`,
            success_url: getStripeSuccessUrl(),
            cancel_url: getStripeCancelUrl(),
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: lower(price.currency),
                        unit_amount: toStripeMinorUnit(amount, price.currency),
                        product_data: {
                            name: `${plan.name} subscription`,
                            description: `${stores.length} store(s), ${plan.duration_days} days`,
                        },
                    },
                },
            ],
            metadata: {
                checkoutType: CHECKOUT_TYPE,
                purchaserCompanyId: String(user.companyId),
                purchaserUserId: String(user.userId),
                planCode: plan.code,
                country,
                currency: price.currency,
                storeIds: stores.map((store) => store.id).join(','),
                couponCode: normalize(data.couponCode),
            },
        });
    } catch (error) {
        throw normalizeStripeError(error);
    }

    return {
        sessionId: session.id,
        checkoutUrl: session.url,
        paymentProvider: 'stripe',
        paymentStatus: session.payment_status || 'unpaid',
        amount,
        currency: price.currency,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    };
};

const buildExistingStripePaymentResult = async (session) => {
    const { SubscriptionPayment, BillingPlan } = require('../../models');
    const payments = await SubscriptionPayment.findAll({
        where: {
            payment_group_uid: session.id,
            payment_provider: 'stripe',
            payment_status: PAID_STATUS,
        },
        include: [{ model: BillingPlan, as: 'plan', attributes: ['id', 'name', 'code', 'duration_days'], required: false }],
        order: [['id', 'ASC']],
    });
    if (!payments.length) return null;

    const firstPayment = payments[0];
    const firstMetadata = parseJsonObject(firstPayment.metadata) || firstPayment.metadata || {};
    return {
        paymentId: session.id,
        paymentProvider: 'stripe',
        paymentStatus: PAID_STATUS,
        couponCode: firstPayment.coupon_code || null,
        couponCodes: payments
            .filter((payment) => payment.coupon_code)
            .map((payment) => ({
                code: payment.coupon_code,
                paymentId: payment.id,
                storeSubscriptionId: payment.store_subscription_id,
                platformStoreId: payment.platform_store_id,
            })),
        redeemedCouponCode: firstMetadata.redeemedCouponCode || session.metadata?.couponCode || null,
        giftCreated: Boolean(firstMetadata.giftCreated),
        planName: firstPayment.plan?.name || null,
        planCode: firstPayment.plan?.code || null,
        period: firstPayment.plan?.duration_days ? `${firstPayment.plan.duration_days} days` : null,
        storeCount: payments.length,
        amount: toNumber(payments.reduce((total, payment) => total + Number(payment.amount || 0), 0)),
        currency: firstPayment.currency,
        paidAt: firstPayment.paid_at,
        payments: payments.map((payment) => ({
            id: payment.id,
            paymentUid: payment.payment_uid,
            storeSubscriptionId: payment.store_subscription_id,
            platformStoreId: payment.platform_store_id,
            amount: toNumber(payment.amount),
            previousExpiry: payment.previous_expiry,
            newExpiry: payment.new_expiry,
        })),
    };
};

const completeStripeCheckoutSession = async (user, data) => {
    const sessionId = normalize(data.sessionId);
    if (!sessionId) throwHttp('Stripe sessionId is required', 400);

    let session;
    try {
        const stripe = getStripeClient();
        session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent'],
        });
    } catch (error) {
        throw normalizeStripeError(error);
    }

    if (session.metadata?.checkoutType !== CHECKOUT_TYPE) throwHttp('Stripe session is not valid for subscription checkout', 400);
    if (Number(session.metadata?.purchaserCompanyId) !== Number(user.companyId)) throwHttp('Stripe session does not belong to this company', 403);
    if (Number(session.metadata?.purchaserUserId) !== Number(user.userId)) throwHttp('Stripe session does not belong to this user', 403);
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
        throwHttp('Stripe payment is not completed yet', 400);
    }

    const existingResult = await buildExistingStripePaymentResult(session);
    if (existingResult) return existingResult;

    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    const checkoutData = {
        planCode: session.metadata.planCode,
        country: session.metadata.country,
        currency: session.metadata.currency,
        storeIds: normalize(session.metadata.storeIds)
            .split(',')
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0),
        couponCode: normalize(session.metadata.couponCode) || undefined,
    };

    return completePaidCheckout(user, checkoutData, {
        paymentProvider: 'stripe',
        paymentGroupUid: session.id,
        paymentUidFactory: ({ index }) => makeStripePaymentUid(session, index),
        metadata: {
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId || null,
            stripeAmountTotal: session.amount_total,
            stripeCurrency: session.currency,
        },
    });
};

const getPaymentHistory = async (user, filters = {}) => {
    const { SubscriptionPayment, BillingPlan, PlatformStore, StoreSubscription } = require('../../models');
    const where = { purchaser_company_id: user.companyId };
    if (filters.platformStoreId) where.platform_store_id = Number(filters.platformStoreId);

    return SubscriptionPayment.findAll({
        where,
        include: [
            { model: BillingPlan, as: 'plan', attributes: ['id', 'name', 'code', 'duration_days'] },
            { model: PlatformStore, as: 'platformStore', attributes: ['id', 'platform', 'store_name', 'external_store_name', 'region'], required: false },
            { model: StoreSubscription, as: 'subscription', attributes: ['id', 'canonical_key', 'status', 'expires_at'] },
        ],
        order: [['created_at', 'DESC']],
        limit: Math.min(Number(filters.limit || 50), 200),
    });
};

const validateCoupon = async (user, data) => {
    const stores = await resolvePlatformStores(user, data);
    const subscriptions = await Promise.all(stores.map((store) => ensureStoreSubscription(store)));
    const subscription = subscriptions[0];
    const plan = data.planCode || data.planName
        ? (await getPlanForCheckout({
            planCode: data.planCode,
            planName: data.planName,
            country: data.country,
            currency: data.currency,
        })).row
        : { duration_days: Number(data.durationDays || 0) };
    const result = await validateCouponForSubscription({
        user,
        couponCode: data.couponCode,
        subscriptionId: subscription.id,
        subscriptionIds: subscriptions.map((item) => item.id),
        platformStoreIds: stores.map((store) => getModelValue(store, 'id')).filter(Boolean),
        plan,
    });
    return { eligible: result.eligible, reason: result.reason || null };
};

const checkReferralEligibility = async (user, data) => {
    return sequelize.transaction(async (transaction) => {
        const stores = await resolvePlatformStores(user, data, transaction);
        const subscriptions = await Promise.all(stores.map((store) => ensureStoreSubscription(store, transaction)));
        const plan = data.planCode || data.planName
            ? (await getPlanForCheckout({
                planCode: data.planCode,
                planName: data.planName,
                country: data.country,
                currency: data.currency,
            })).row
            : { duration_days: Number(data.durationDays || 0) };

        const result = await getReferralPurchaseEligibility({
            user,
            plan,
            subscriptionIds: subscriptions.map((item) => item.id),
            platformStoreIds: stores.map((store) => getModelValue(store, 'id')).filter(Boolean),
            transaction,
        });

        return {
            eligible: result.eligible,
            reason: result.reason || null,
            storeCount: stores.length,
        };
    });
};

const listCoupons = async (user) => {
    const { Coupon } = require('../../models');
    return Coupon.findAll({
        where: { owner_company_id: user.companyId },
        order: [['created_at', 'DESC']],
    });
};

const isRecipientOwner = (user, gift) =>
    Number(gift.recipient_company_id) === Number(user.companyId) &&
    (user.isOwner || Number(gift.recipient_user_id) === Number(user.userId));

const assertGiftAccess = async (user, giftId) => {
    const { Gift, Coupon, StoreSubscription, GiftStatusHistory } = require('../../models');
    const gift = await Gift.findOne({
        where: { id: giftId, recipient_company_id: user.companyId },
        include: [
            { model: Coupon, as: 'coupon', attributes: ['id', 'code', 'status'] },
            { model: StoreSubscription, as: 'subscription', attributes: ['id', 'platform', 'marketplace_country', 'external_shop_id', 'status', 'expires_at'] },
            { model: GiftStatusHistory, as: 'history', required: false },
        ],
        order: [[{ model: GiftStatusHistory, as: 'history' }, 'created_at', 'DESC']],
    });
    if (!gift) {
        const err = new Error('Gift not found');
        err.statusCode = 404;
        throw err;
    }
    return gift;
};

const listGifts = async (user) => {
    const { Gift, Coupon } = require('../../models');
    return Gift.findAll({
        where: { recipient_company_id: user.companyId },
        include: [{ model: Coupon, as: 'coupon', attributes: ['id', 'code'] }],
        order: [['created_at', 'DESC']],
    });
};

const getGiftNotificationCount = async (user) => {
    const { Gift } = require('../../models');
    const count = await Gift.count({
        where: {
            recipient_company_id: user.companyId,
            modal_seen_at: null,
            status: { [Op.notIn]: ['DECLINED', 'CANCELLED', 'RECEIVED'] },
        },
    });
    return { count };
};

const markGiftSeen = async (user, giftId) => {
    const gift = await assertGiftAccess(user, giftId);
    if (!gift.modal_seen_at) await gift.update({ modal_seen_at: new Date() });
    return gift.reload();
};

const transitionGift = async ({ user, giftId, nextStatus, updates = {}, note, trackingNumber }) => {
    const { GiftStatusHistory } = require('../../models');
    const gift = await assertGiftAccess(user, giftId);
    const previousStatus = gift.status;
    const allowed = {
        PENDING_ADDRESS: ['ADDRESS_SUBMITTED', 'DECLINED', 'CANCELLED'],
        ADDRESS_SUBMITTED: ['ON_THE_WAY', 'DECLINED', 'CANCELLED'],
        ON_THE_WAY: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['RECEIVED'],
        RECEIVED: [],
        DECLINED: [],
        CANCELLED: [],
    };

    if (!allowed[previousStatus]?.includes(nextStatus)) {
        const err = new Error(`Cannot change gift status from ${previousStatus} to ${nextStatus}`);
        err.statusCode = 400;
        throw err;
    }

    await sequelize.transaction(async (transaction) => {
        await gift.update({ ...updates, status: nextStatus }, { transaction });
        await GiftStatusHistory.create({
            gift_id: gift.id,
            previous_status: previousStatus,
            new_status: nextStatus,
            changed_by_user_id: user.userId,
            note: note || null,
            tracking_number: trackingNumber || updates.tracking_number || null,
        }, { transaction });
    });

    return assertGiftAccess(user, giftId);
};

const submitGiftAddress = async (user, giftId, address) => {
    const gift = await assertGiftAccess(user, giftId);
    if (!isRecipientOwner(user, gift)) {
        const err = new Error('Only the gift recipient owner can submit the delivery address');
        err.statusCode = 403;
        throw err;
    }
    const nextStatus = gift.status === 'PENDING_ADDRESS' ? 'ADDRESS_SUBMITTED' : gift.status;
    if (!['PENDING_ADDRESS', 'ADDRESS_SUBMITTED'].includes(gift.status)) {
        const err = new Error('Gift address can no longer be updated');
        err.statusCode = 400;
        throw err;
    }
    const deliveryAddress = {
        ...address,
        zipCode: normalize(address.zipCode || address.postalCode),
        postalCode: normalize(address.postalCode || address.zipCode),
    };
    if (nextStatus === gift.status) {
        await gift.update({ delivery_address: deliveryAddress });
        return gift.reload();
    }
    return transitionGift({
        user,
        giftId,
        nextStatus,
        updates: { delivery_address: deliveryAddress },
        note: 'Recipient submitted delivery address',
    });
};

const declineGift = async (user, giftId, note) => {
    const gift = await assertGiftAccess(user, giftId);
    if (!isRecipientOwner(user, gift)) {
        const err = new Error('Only the gift recipient owner can decline this gift');
        err.statusCode = 403;
        throw err;
    }
    return transitionGift({
        user,
        giftId,
        nextStatus: 'DECLINED',
        updates: { declined_at: new Date(), declined_by_user_id: user.userId },
        note: note || 'Gift declined by recipient',
    });
};

const confirmGiftReceived = async (user, giftId) => {
    const gift = await assertGiftAccess(user, giftId);
    if (!isRecipientOwner(user, gift)) {
        const err = new Error('Only the gift recipient owner can confirm receipt');
        err.statusCode = 403;
        throw err;
    }
    return transitionGift({
        user,
        giftId,
        nextStatus: 'RECEIVED',
        updates: { received_at: new Date(), received_by_user_id: user.userId },
        note: 'Gift received by recipient',
    });
};

const updateGiftOperationalStatus = async (user, giftId, status, data = {}) => {
    if (!['owner', 'admin', 'manager'].includes(lower(user.role))) {
        const err = new Error('Only authorized staff can update gift delivery status');
        err.statusCode = 403;
        throw err;
    }

    return transitionGift({
        user,
        giftId,
        nextStatus: status,
        updates: { tracking_number: data.trackingNumber || data.tracking_number || null },
        note: data.note,
        trackingNumber: data.trackingNumber || data.tracking_number,
    });
};

module.exports = {
    getPricing,
    listAdminPlans,
    upsertPlan,
    upsertPlanFeature,
    removePlanFeature,
    upsertPlanTranslation,
    upsertPlanPrice,
    completeDemoCheckout,
    createStripeCheckoutSession,
    completeStripeCheckoutSession,
    getPaymentHistory,
    validateCoupon,
    checkReferralEligibility,
    listCoupons,
    listGifts,
    assertGiftAccess,
    getGiftNotificationCount,
    markGiftSeen,
    submitGiftAddress,
    declineGift,
    confirmGiftReceived,
    updateGiftOperationalStatus,
    ensureStoreSubscription,
    getSubscriptionSnapshotForStore,
    appendSubscriptionSnapshots,
    isStoreSubscriptionActive,
    assertStoreSubscriptionActive,
};
