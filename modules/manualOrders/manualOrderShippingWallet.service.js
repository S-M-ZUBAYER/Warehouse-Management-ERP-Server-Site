'use strict';

const crypto = require('crypto');
const axios = require('axios');
const Stripe = require('stripe');
const { sequelize } = require('../../config/database');

const CHECKOUT_TYPE = 'manual_order_shipping_wallet_topup';
const WALLET_CURRENCY = 'MYR';
const SUPPORTED_TOP_UP_CURRENCIES = ['MYR', 'USD', 'SGD', 'THB', 'IDR', 'CNY', 'PHP', 'VND'];
const PAID_STATUS = 'succeeded';
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const DEFAULT_FX_TO_MYR = {
    MYR: 1,
    USD: 4.7,
    SGD: 3.5,
    THB: 0.13,
    IDR: 0.00029,
    CNY: 0.65,
    PHP: 0.082,
    VND: 0.00018,
};

let stripeClient = null;
const liveFxCache = new Map();

const normalize = (value) => (value === undefined || value === null ? '' : String(value).trim());
const upper = (value) => normalize(value).toUpperCase();
const lower = (value) => normalize(value).toLowerCase();
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const toMoney = (value) => Math.round(toNumber(value) * 100) / 100;
const toFxRate = (value) => Math.round(toNumber(value) * 100000000) / 100000000;
const toMetadataValue = (value, maxLength = 250) => normalize(value).slice(0, maxLength);

const throwHttp = (message, statusCode = 400, extra = {}) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    Object.assign(err, extra);
    throw err;
};

const resolveCompanyId = (user) => {
    const companyId = Number(user?.companyId);
    if (Number.isInteger(companyId) && companyId > 0) return companyId;
    throwHttp('companyId is required', 400);
};

const getUserId = (user) => user?.userId || user?.id || null;

const parseFxOverrides = () => {
    try {
        const parsed = JSON.parse(process.env.MANUAL_ORDER_SHIPPING_FX_TO_MYR_JSON || '{}');
        return Object.entries(parsed).reduce((acc, [currency, rate]) => {
            const normalizedCurrency = upper(currency);
            const numericRate = Number(rate);
            if (normalizedCurrency && Number.isFinite(numericRate) && numericRate > 0) acc[normalizedCurrency] = numericRate;
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const getFxRateToMyr = (currency) => {
    const normalizedCurrency = upper(currency || WALLET_CURRENCY);
    const configuredKey = `MANUAL_ORDER_SHIPPING_FX_${normalizedCurrency}_TO_MYR`;
    const configuredRate = Number(process.env[configuredKey]);
    if (Number.isFinite(configuredRate) && configuredRate > 0) return configuredRate;
    const rates = { ...DEFAULT_FX_TO_MYR, ...parseFxOverrides() };
    const rate = Number(rates[normalizedCurrency]);
    if (Number.isFinite(rate) && rate > 0) return rate;
    throwHttp(`Currency ${normalizedCurrency} is not supported for Manual Order shipping wallet top-up.`, 400);
};

const getFxCacheTtlMs = () => {
    const ttlMs = Number(process.env.MANUAL_ORDER_SHIPPING_FX_CACHE_TTL_MS);
    return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 10 * 60 * 1000;
};

const getFxTimeoutMs = () => {
    const timeoutMs = Number(process.env.MANUAL_ORDER_SHIPPING_FX_TIMEOUT_MS);
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
};

const getFxMarginToMyr = () => {
    const margin = Number(process.env.MANUAL_ORDER_SHIPPING_FX_MARGIN_TO_MYR);
    return Number.isFinite(margin) && margin >= 0 ? margin : 0.01;
};

const getTopUpFeeReserve = (grossAmountMyr) => {
    const percent = Number(process.env.MANUAL_ORDER_SHIPPING_TOPUP_FEE_PERCENT);
    const fixedMyr = Number(process.env.MANUAL_ORDER_SHIPPING_TOPUP_FEE_FIXED_MYR);
    const feePercent = Number.isFinite(percent) && percent >= 0 ? percent : 0.06;
    const feeFixedMyr = Number.isFinite(fixedMyr) && fixedMyr >= 0 ? fixedMyr : 1;
    const feeReserveMyr = toMoney((toMoney(grossAmountMyr) * feePercent) + feeFixedMyr);
    return { feePercent, feeFixedMyr, feeReserveMyr };
};

const fetchLiveFxRateToMyr = async (currency) => {
    const normalizedCurrency = upper(currency || WALLET_CURRENCY);
    if (normalizedCurrency === WALLET_CURRENCY) {
        return { rate: 1, source: 'wallet_currency' };
    }

    const cacheKey = `${normalizedCurrency}:${WALLET_CURRENCY}`;
    const cached = liveFxCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < getFxCacheTtlMs()) {
        return { rate: cached.rate, source: 'live_cache' };
    }

    const baseUrl = normalize(process.env.MANUAL_ORDER_SHIPPING_FX_API_BASE_URL || 'https://open.er-api.com/v6/latest').replace(/\/+$/, '');
    const response = await axios.get(`${baseUrl}/${encodeURIComponent(normalizedCurrency)}`, {
        timeout: getFxTimeoutMs(),
        headers: { Accept: 'application/json' },
    });
    const rate = Number(response.data?.rates?.[WALLET_CURRENCY]);
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Live FX response did not include ${normalizedCurrency} to ${WALLET_CURRENCY}`);
    }

    liveFxCache.set(cacheKey, { rate, fetchedAt: now });
    return { rate, source: response.data?.provider || 'open.er-api.com' };
};

const getTopUpFxRateToMyr = async (currency) => {
    const normalizedCurrency = upper(currency || WALLET_CURRENCY);
    const fxMarginToMyr = normalizedCurrency === WALLET_CURRENCY ? 0 : getFxMarginToMyr();
    try {
        const live = await fetchLiveFxRateToMyr(normalizedCurrency);
        return {
            baseFxRateToMyr: toFxRate(live.rate),
            fxMarginToMyr: toFxRate(fxMarginToMyr),
            fxRateToMyr: toFxRate(live.rate + fxMarginToMyr),
            fxSource: live.source,
        };
    } catch (error) {
        const fallbackRate = getFxRateToMyr(normalizedCurrency);
        return {
            baseFxRateToMyr: toFxRate(fallbackRate),
            fxMarginToMyr: toFxRate(fxMarginToMyr),
            fxRateToMyr: toFxRate(fallbackRate + fxMarginToMyr),
            fxSource: 'configured_fallback',
            fxError: normalize(error?.message || error),
        };
    }
};

const convertTopUpToMyr = async (amount, currency) => {
    const originalAmount = toMoney(amount);
    if (originalAmount <= 0) throwHttp('Amount must be greater than 0', 400);
    const originalCurrency = upper(currency || WALLET_CURRENCY);
    const fx = await getTopUpFxRateToMyr(originalCurrency);
    const grossAmountMyr = toMoney(originalAmount * fx.fxRateToMyr);
    const feeReserve = getTopUpFeeReserve(grossAmountMyr);
    const amountMyr = toMoney(grossAmountMyr - feeReserve.feeReserveMyr);
    return {
        originalAmount,
        originalCurrency,
        ...fx,
        grossAmountMyr,
        topUpFeeReserveMyr: feeReserve.feeReserveMyr,
        topUpFeePercent: feeReserve.feePercent,
        topUpFeeFixedMyr: feeReserve.feeFixedMyr,
        amountMyr,
    };
};

const convertToMyr = (amount, currency) => {
    const originalAmount = toMoney(amount);
    if (originalAmount <= 0) throwHttp('Amount must be greater than 0', 400);
    const originalCurrency = upper(currency || WALLET_CURRENCY);
    const fxRateToMyr = getFxRateToMyr(originalCurrency);
    return {
        originalAmount,
        originalCurrency,
        fxRateToMyr,
        amountMyr: toMoney(originalAmount * fxRateToMyr),
    };
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

const getStripeSuccessUrl = () => `${getFrontendBaseUrl()}/warehouse_management/orders/manual_order?shipping_wallet_session_id={CHECKOUT_SESSION_ID}`;
const getStripeCancelUrl = () => `${getFrontendBaseUrl()}/warehouse_management/orders/manual_order?shipping_wallet_cancelled=1`;

const toStripeMinorUnit = (amount, currency) => {
    const roundedAmount = toNumber(amount);
    return STRIPE_ZERO_DECIMAL_CURRENCIES.has(upper(currency))
        ? Math.round(roundedAmount)
        : Math.round(roundedAmount * 100);
};

const getWalletForUpdate = async ({ companyId, userId, transaction, lock = false }) => {
    const { CompanyShippingWallet } = require('../../models');
    let wallet = await CompanyShippingWallet.findOne({
        where: { company_id: companyId },
        transaction,
        lock: lock && transaction ? (transaction.LOCK?.UPDATE || true) : undefined,
    });
    if (!wallet) {
        try {
            wallet = await CompanyShippingWallet.create({
                company_id: companyId,
                currency: WALLET_CURRENCY,
                balance_myr: 0,
                created_by: userId || null,
                updated_by: userId || null,
            }, { transaction });
        } catch (error) {
            const isDuplicateWallet = error?.name === 'SequelizeUniqueConstraintError' || /Duplicate entry/i.test(error?.message || '');
            if (!isDuplicateWallet) throw error;
            wallet = await CompanyShippingWallet.findOne({
                where: { company_id: companyId },
                transaction,
                lock: lock && transaction ? (transaction.LOCK?.UPDATE || true) : undefined,
            });
            if (!wallet) throw error;
        }
    }
    return wallet;
};

const serializeLedger = (row) => row ? {
    id: row.id,
    type: row.type,
    amountMyr: toNumber(row.amount_myr),
    balanceBeforeMyr: toNumber(row.balance_before_myr),
    balanceAfterMyr: toNumber(row.balance_after_myr),
    originalAmount: row.original_amount == null ? null : toNumber(row.original_amount),
    originalCurrency: row.original_currency || null,
    fxRateToMyr: row.fx_rate_to_myr == null ? null : Number(row.fx_rate_to_myr),
    provider: row.provider || null,
    reference: row.reference || null,
    status: row.status,
    manualOrderId: row.manual_order_id || null,
    metadata: row.metadata || null,
    createdAt: row.created_at,
} : null;

const serializeWallet = (wallet) => ({
    id: wallet.id,
    companyId: wallet.company_id,
    currency: WALLET_CURRENCY,
    balanceMyr: toNumber(wallet.balance_myr),
    updatedAt: wallet.updated_at,
});

const getWalletSummary = async (user) => {
    const companyId = resolveCompanyId(user);
    const userId = getUserId(user);
    const wallet = await sequelize.transaction((transaction) => getWalletForUpdate({ companyId, userId, transaction }));
    return {
        wallet: serializeWallet(wallet),
        supportedTopUpCurrencies: SUPPORTED_TOP_UP_CURRENCIES,
        fxRatesToMyr: Object.keys({ ...DEFAULT_FX_TO_MYR, ...parseFxOverrides() }).sort().reduce((acc, currency) => {
            acc[currency] = getFxRateToMyr(currency);
            return acc;
        }, {}),
    };
};

const listLedger = async (user, filters = {}) => {
    const { CompanyShippingWalletLedger } = require('../../models');
    const companyId = resolveCompanyId(user);
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
    const rows = await CompanyShippingWalletLedger.findAll({
        where: { company_id: companyId },
        order: [['created_at', 'DESC']],
        limit,
    });
    return rows.map(serializeLedger);
};

const createTopUpCheckoutSession = async (user, data = {}) => {
    const companyId = resolveCompanyId(user);
    const userId = getUserId(user);
    const originalCurrency = upper(data.currency || 'MYR');
    if (!SUPPORTED_TOP_UP_CURRENCIES.includes(originalCurrency)) {
        throwHttp('Please choose an available Manual Order shipping wallet top-up currency.', 400, { code: 'UNSUPPORTED_SHIPPING_WALLET_TOPUP_CURRENCY' });
    }
    const converted = await convertTopUpToMyr(data.amount, originalCurrency);
    if (converted.amountMyr < 1) throwHttp('Top-up amount must convert to at least MYR 1.00', 400);

    let session;
    try {
        const stripe = getStripeClient();
        session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: user.email || undefined,
            client_reference_id: `${companyId}:${userId}:${Date.now()}`,
            success_url: getStripeSuccessUrl(),
            cancel_url: getStripeCancelUrl(),
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: lower(originalCurrency),
                        unit_amount: toStripeMinorUnit(converted.originalAmount, originalCurrency),
                        product_data: {
                            name: 'Manual Order shipping wallet top-up',
                            description: `Adds ${WALLET_CURRENCY} ${converted.amountMyr.toFixed(2)} to company shipping wallet after payment processing reserve`,
                        },
                    },
                },
            ],
            metadata: {
                checkoutType: CHECKOUT_TYPE,
                purchaserCompanyId: String(companyId),
                purchaserUserId: String(userId),
                originalAmount: String(converted.originalAmount),
                originalCurrency,
                amountMyr: String(converted.amountMyr),
                grossAmountMyr: String(converted.grossAmountMyr),
                topUpFeeReserveMyr: String(converted.topUpFeeReserveMyr),
                topUpFeePercent: String(converted.topUpFeePercent),
                topUpFeeFixedMyr: String(converted.topUpFeeFixedMyr),
                fxRateToMyr: String(converted.fxRateToMyr),
                baseFxRateToMyr: String(converted.baseFxRateToMyr),
                fxMarginToMyr: String(converted.fxMarginToMyr),
                fxSource: converted.fxSource,
                fxError: toMetadataValue(converted.fxError || ''),
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
        originalAmount: converted.originalAmount,
        originalCurrency,
        amountMyr: converted.amountMyr,
        grossAmountMyr: converted.grossAmountMyr,
        topUpFeeReserveMyr: converted.topUpFeeReserveMyr,
        fxRateToMyr: converted.fxRateToMyr,
        baseFxRateToMyr: converted.baseFxRateToMyr,
        fxMarginToMyr: converted.fxMarginToMyr,
        fxSource: converted.fxSource,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    };
};

const completeTopUpCheckoutSession = async (user, data = {}) => {
    const sessionId = normalize(data.sessionId);
    if (!sessionId) throwHttp('Stripe sessionId is required', 400);
    const companyId = resolveCompanyId(user);
    const userId = getUserId(user);

    let session;
    try {
        const stripe = getStripeClient();
        session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    } catch (error) {
        throw normalizeStripeError(error);
    }

    if (session.metadata?.checkoutType !== CHECKOUT_TYPE) throwHttp('Stripe session is not valid for Manual Order shipping wallet top-up', 400);
    if (Number(session.metadata?.purchaserCompanyId) !== Number(companyId)) throwHttp('Stripe session does not belong to this company', 403);
    if (Number(session.metadata?.purchaserUserId) !== Number(userId)) throwHttp('Stripe session does not belong to this user', 403);
    if (session.status !== 'complete' || session.payment_status !== 'paid') throwHttp('Stripe payment is not completed yet', 400);

    const { CompanyShippingWalletLedger } = require('../../models');
    const converted = {
        originalAmount: toMoney(session.metadata.originalAmount || (session.amount_total ? session.amount_total / 100 : 0)),
        originalCurrency: upper(session.metadata.originalCurrency || session.currency || 'MYR'),
        amountMyr: toMoney(session.metadata.amountMyr),
        grossAmountMyr: toMoney(session.metadata.grossAmountMyr || session.metadata.amountMyr),
        topUpFeeReserveMyr: toMoney(session.metadata.topUpFeeReserveMyr || 0),
        topUpFeePercent: Number(session.metadata.topUpFeePercent || 0),
        topUpFeeFixedMyr: Number(session.metadata.topUpFeeFixedMyr || 0),
        fxRateToMyr: Number(session.metadata.fxRateToMyr || 1),
        baseFxRateToMyr: Number(session.metadata.baseFxRateToMyr || session.metadata.fxRateToMyr || 1),
        fxMarginToMyr: Number(session.metadata.fxMarginToMyr || 0),
        fxSource: session.metadata.fxSource || null,
        fxError: session.metadata.fxError || null,
    };
    if (converted.amountMyr <= 0) throwHttp('Stripe session is missing top-up MYR amount', 400);

    let result;
    await sequelize.transaction(async (transaction) => {
        const wallet = await getWalletForUpdate({ companyId, userId, transaction, lock: true });
        const existingLedger = await CompanyShippingWalletLedger.findOne({
            where: { company_id: companyId, reference: session.id, type: 'topup', status: PAID_STATUS },
            transaction,
            lock: transaction.LOCK?.UPDATE || true,
        });
        if (existingLedger) {
            result = { wallet: serializeWallet(wallet), ledger: serializeLedger(existingLedger), alreadyCompleted: true };
            return;
        }

        const before = toMoney(wallet.balance_myr);
        const after = toMoney(before + converted.amountMyr);
        await wallet.update({ balance_myr: after, updated_by: userId }, { transaction });
        const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const ledger = await CompanyShippingWalletLedger.create({
            company_id: companyId,
            wallet_id: wallet.id,
            type: 'topup',
            amount_myr: converted.amountMyr,
            balance_before_myr: before,
            balance_after_myr: after,
            original_amount: converted.originalAmount,
            original_currency: converted.originalCurrency,
            fx_rate_to_myr: converted.fxRateToMyr,
            provider: 'stripe',
            reference: session.id,
            status: PAID_STATUS,
            metadata: {
                stripeSessionId: session.id,
                stripePaymentIntentId: intentId || null,
                stripeAmountTotal: session.amount_total,
                stripeCurrency: session.currency,
                grossAmountMyr: converted.grossAmountMyr,
                topUpFeeReserveMyr: converted.topUpFeeReserveMyr,
                topUpFeePercent: converted.topUpFeePercent,
                topUpFeeFixedMyr: converted.topUpFeeFixedMyr,
                baseFxRateToMyr: converted.baseFxRateToMyr,
                fxMarginToMyr: converted.fxMarginToMyr,
                fxSource: converted.fxSource,
                fxError: converted.fxError,
            },
            created_by: userId,
        }, { transaction });
        result = { wallet: serializeWallet(wallet), ledger: serializeLedger(ledger), alreadyCompleted: false };
    });

    return {
        ...result,
        supportedTopUpCurrencies: SUPPORTED_TOP_UP_CURRENCIES,
    };
};
const debitForManualOrderBooking = async ({ user, manualOrderId, amount, currency, provider = 'easyparcel', reference = '', metadata = {} }) => {
    const { CompanyShippingWalletLedger } = require('../../models');
    const companyId = resolveCompanyId(user);
    const userId = getUserId(user);
    const converted = convertToMyr(amount, currency || WALLET_CURRENCY);
    if (converted.amountMyr <= 0) throwHttp('Courier charge must be greater than 0', 400);

    let result;
    await sequelize.transaction(async (transaction) => {
        const wallet = await getWalletForUpdate({ companyId, userId, transaction, lock: true });
        const before = toMoney(wallet.balance_myr);
        if (before < converted.amountMyr) {
            throwHttp('Insufficient Manual Order shipping balance. Please top up your shipping wallet before booking courier delivery.', 402, {
                code: 'INSUFFICIENT_SHIPPING_WALLET_BALANCE',
                requiredMyr: converted.amountMyr,
                balanceMyr: before,
            });
        }
        const after = toMoney(before - converted.amountMyr);
        await wallet.update({ balance_myr: after, updated_by: userId }, { transaction });
        const ledger = await CompanyShippingWalletLedger.create({
            company_id: companyId,
            wallet_id: wallet.id,
            manual_order_id: manualOrderId || null,
            type: 'courier_debit',
            amount_myr: -converted.amountMyr,
            balance_before_myr: before,
            balance_after_myr: after,
            original_amount: converted.originalAmount,
            original_currency: converted.originalCurrency,
            fx_rate_to_myr: converted.fxRateToMyr,
            provider,
            reference: reference || `manual-order-${manualOrderId || Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            status: PAID_STATUS,
            metadata,
            created_by: userId,
        }, { transaction });
        result = { wallet: serializeWallet(wallet), ledger: serializeLedger(ledger), charge: converted };
    });
    return result;
};

const refundManualOrderDebit = async ({ user, debitLedgerId, manualOrderId, reason = 'Courier booking failed' }) => {
    if (!debitLedgerId) return null;
    const { CompanyShippingWalletLedger } = require('../../models');
    const companyId = resolveCompanyId(user);
    const userId = getUserId(user);
    const debitLedger = await CompanyShippingWalletLedger.findOne({
        where: { id: debitLedgerId, company_id: companyId, type: 'courier_debit', status: PAID_STATUS },
    });
    if (!debitLedger) return null;
    const existingRefund = await CompanyShippingWalletLedger.findOne({
        where: { company_id: companyId, type: 'refund', reference: `refund:${debitLedger.id}` },
    });
    if (existingRefund) return { ledger: serializeLedger(existingRefund), alreadyRefunded: true };

    let result;
    await sequelize.transaction(async (transaction) => {
        const wallet = await getWalletForUpdate({ companyId, userId, transaction, lock: true });
        const refundAmount = Math.abs(toMoney(debitLedger.amount_myr));
        const before = toMoney(wallet.balance_myr);
        const after = toMoney(before + refundAmount);
        await wallet.update({ balance_myr: after, updated_by: userId }, { transaction });
        const ledger = await CompanyShippingWalletLedger.create({
            company_id: companyId,
            wallet_id: wallet.id,
            manual_order_id: manualOrderId || debitLedger.manual_order_id || null,
            type: 'refund',
            amount_myr: refundAmount,
            balance_before_myr: before,
            balance_after_myr: after,
            original_amount: debitLedger.original_amount,
            original_currency: debitLedger.original_currency,
            fx_rate_to_myr: debitLedger.fx_rate_to_myr,
            provider: debitLedger.provider,
            reference: `refund:${debitLedger.id}`,
            status: PAID_STATUS,
            metadata: { reason, debitLedgerId: debitLedger.id },
            created_by: userId,
        }, { transaction });
        result = { wallet: serializeWallet(wallet), ledger: serializeLedger(ledger) };
    });
    return result;
};

const refundManualOrderAmount = async ({ user, debitLedgerId, manualOrderId, amountMyr, reason = 'Courier booking adjustment', reference = '' }) => {
    const refundAmount = toMoney(amountMyr);
    if (!debitLedgerId || refundAmount <= 0) return null;
    const { CompanyShippingWalletLedger } = require('../../models');
    const companyId = resolveCompanyId(user);
    const userId = getUserId(user);
    const debitLedger = await CompanyShippingWalletLedger.findOne({
        where: { id: debitLedgerId, company_id: companyId, type: 'courier_debit', status: PAID_STATUS },
    });
    if (!debitLedger) return null;

    const refundReference = reference || `refund:${debitLedger.id}:${refundAmount.toFixed(2)}`;
    const existingRefund = await CompanyShippingWalletLedger.findOne({
        where: { company_id: companyId, type: 'refund', reference: refundReference },
    });
    if (existingRefund) return { ledger: serializeLedger(existingRefund), alreadyRefunded: true };

    let result;
    await sequelize.transaction(async (transaction) => {
        const wallet = await getWalletForUpdate({ companyId, userId, transaction, lock: true });
        const before = toMoney(wallet.balance_myr);
        const after = toMoney(before + refundAmount);
        await wallet.update({ balance_myr: after, updated_by: userId }, { transaction });
        const ledger = await CompanyShippingWalletLedger.create({
            company_id: companyId,
            wallet_id: wallet.id,
            manual_order_id: manualOrderId || debitLedger.manual_order_id || null,
            type: 'refund',
            amount_myr: refundAmount,
            balance_before_myr: before,
            balance_after_myr: after,
            original_amount: refundAmount,
            original_currency: WALLET_CURRENCY,
            fx_rate_to_myr: 1,
            provider: debitLedger.provider,
            reference: refundReference,
            status: PAID_STATUS,
            metadata: { reason, debitLedgerId: debitLedger.id, partial: true },
            created_by: userId,
        }, { transaction });
        result = { wallet: serializeWallet(wallet), ledger: serializeLedger(ledger) };
    });
    return result;
};

module.exports = {
    CHECKOUT_TYPE,
    WALLET_CURRENCY,
    getWalletSummary,
    listLedger,
    createTopUpCheckoutSession,
    completeTopUpCheckoutSession,
    debitForManualOrderBooking,
    refundManualOrderDebit,
    refundManualOrderAmount,
    convertToMyr,
    getFxRateToMyr,
};








