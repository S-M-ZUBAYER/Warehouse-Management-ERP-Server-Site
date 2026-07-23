"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { sequelize } = require("../../config/database");
const platformOrderDeductionsService = require("../platformOrderDeductions/platformOrderDeductions.service");

const DEFAULT_IMAGE = "https://placehold.co/36x36/E6ECF0/004368?text=?";
const EASY_PARCEL_TIMEOUT_MS = Number(process.env.EASYPARCEL_TIMEOUT_MS || 20000);

const normalizeString = (value) => {
    if (value === undefined || value === null) return "";
    return String(value).trim();
};

const toPositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        const err = new Error(`${fieldName} must be a positive integer`);
        err.statusCode = 400;
        throw err;
    }
    return parsed;
};

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const generateOrderNumber = (type) => {
    const prefix = type === "gift" ? "GIFT" : "MANUAL";
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return `${prefix}-${stamp}-${Math.floor(Math.random() * 9000 + 1000)}`;
};

const resolveCompanyId = (user) => {
    const companyId = Number(user?.companyId);
    if (Number.isInteger(companyId) && companyId > 0) return companyId;
    const err = new Error("companyId is required");
    err.statusCode = 400;
    throw err;
};

const getEnv = (...names) => {
    for (const name of names) {
        const value = normalizeString(process.env[name]);
        if (value) return value;
    }
    return "";
};

const normalizeBool = (value, fallback = false) => {
    const normalized = normalizeString(value).toLowerCase();
    if (!normalized) return fallback;
    return ["1", "true", "yes", "y", "on", "marketplace"].includes(normalized);
};

const normalizeCountryCode = (value, fallback = "MY") => {
    const raw = normalizeString(value || fallback).toUpperCase();
    if (!raw) return fallback;
    const compact = raw.replace(/[^A-Z]/g, "");

    const aliases = {
        MALAYSIA: "MY",
        MY: "MY",
        MYS: "MY",
        SINGAPORE: "SG",
        SG: "SG",
        SGP: "SG",
        THAILAND: "TH",
        THAI: "TH",
        TH: "TH",
        THA: "TH",
        VIETNAM: "VN",
        VIETNAMVIETNAM: "VN",
        VN: "VN",
        VNM: "VN",
        PHILIPPINES: "PH",
        PHILIPPINE: "PH",
        PH: "PH",
        PHL: "PH",
        INDONESIA: "ID",
        ID: "ID",
        IDN: "ID",
        CHINA: "CN",
        CN: "CN",
        CHN: "CN",
    };

    if (aliases[compact]) return aliases[compact];
    if (compact.length === 2) return compact;
    if (compact.includes("MALAYSIA")) return "MY";
    if (compact.includes("SINGAPORE")) return "SG";
    if (compact.includes("THAILAND") || compact.includes("THAI")) return "TH";
    if (compact.includes("VIETNAM")) return "VN";
    if (compact.includes("PHILIPPINE")) return "PH";
    if (compact.includes("INDONESIA")) return "ID";
    if (compact.includes("CHINA")) return "CN";
    return fallback;
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const trimMax = (value, max = 35) => normalizeString(value).slice(0, max);

const splitAddress = (address, maxLength = 35, count = 4) => {
    const cleaned = normalizeString(address).replace(/\s+/g, " ");
    const parts = [];
    let remaining = cleaned;
    for (let i = 0; i < count; i += 1) {
        if (!remaining) {
            parts.push("");
            continue;
        }
        parts.push(remaining.slice(0, maxLength));
        remaining = remaining.slice(maxLength).trim();
    }
    return parts;
};

const EASY_PARCEL_API_BASE_URL = (getEnv("EASYPARCEL_API_BASE_URL") || "https://api.easyparcel.com").replace(/\/+$/, "");
const EASY_PARCEL_OPEN_API_VERSION = getEnv("EASYPARCEL_OPEN_API_VERSION") || "2026-03";
const EASY_PARCEL_AUTH_URL = getEnv("EASYPARCEL_AUTH_URL") || `${EASY_PARCEL_API_BASE_URL}/oauth/login`;
const EASY_PARCEL_TOKEN_URL = getEnv("EASYPARCEL_TOKEN_URL") || `${EASY_PARCEL_API_BASE_URL}/oauth/token`;
const EASY_PARCEL_TOKEN_REFRESH_SKEW_MS = Number(process.env.EASYPARCEL_TOKEN_REFRESH_SKEW_MS || 5 * 60 * 1000);
const AFTERSHIP_TIMEOUT_MS = Number(process.env.AFTERSHIP_TIMEOUT_MS || 20000);
const AFTERSHIP_SHIPPING_SANDBOX_BASE_URL = "https://sandbox-api.aftership.com/postmen/v3";
const AFTERSHIP_SHIPPING_PRODUCTION_BASE_URL = "https://api.aftership.com/postmen/v3";
const AFTERSHIP_TRACKING_BASE_URL = "https://api.aftership.com/tracking/2026-01";
const ENV_PATH = path.resolve(process.cwd(), ".env");

const EASY_PARCEL_SUPPORTED_COUNTRIES = {
    MY: { code: "MY", name: "Malaysia", currency: "MYR", phoneCode: "MY", defaultSubdivision: "MY-14" },
    SG: { code: "SG", name: "Singapore", currency: "SGD", phoneCode: "SG", defaultSubdivision: "SG-01" },
    TH: { code: "TH", name: "Thailand", currency: "THB", phoneCode: "TH", defaultSubdivision: "" },
    ID: { code: "ID", name: "Indonesia", currency: "IDR", phoneCode: "ID", defaultSubdivision: "" },
};

const AFTERSHIP_SUPPORTED_COUNTRIES = {
    PH: { code: "PH", alpha3: "PHL", name: "Philippines", currency: "PHP", phoneCode: "PH" },
    VN: { code: "VN", alpha3: "VNM", name: "Vietnam", currency: "VND", phoneCode: "VN" },
    TH: { code: "TH", alpha3: "THA", name: "Thailand", currency: "THB", phoneCode: "TH" },
    ID: { code: "ID", alpha3: "IDN", name: "Indonesia", currency: "IDR", phoneCode: "ID" },
    MY: { code: "MY", alpha3: "MYS", name: "Malaysia", currency: "MYR", phoneCode: "MY" },
    SG: { code: "SG", alpha3: "SGP", name: "Singapore", currency: "SGD", phoneCode: "SG" },
};

const MANUAL_ORDER_STATUSES = {
    CREATED: "CREATED",
    BOOKING_PENDING: "BOOKING_PENDING",
    BOOKING_FAILED: "BOOKING_FAILED",
    SCHEDULE_IN_ARRANGEMENT: "SCHEDULE_IN_ARRANGEMENT",
    TO_BE_COLLECTED: "TO_BE_COLLECTED",
    DROP_OFF: "DROP_OFF",
    COLLECTED: "COLLECTED",
    DELIVERY_IN_TRANSIT: "DELIVERY_IN_TRANSIT",
    DELIVERY_ON_HOLD: "DELIVERY_ON_HOLD",
    DELIVERED: "DELIVERED",
    RETURNED: "RETURNED",
    CANCELLED: "CANCELLED",
};

const EASY_PARCEL_STATUS_CODE_MAP = {
    0: MANUAL_ORDER_STATUSES.CANCELLED,
    2: MANUAL_ORDER_STATUSES.TO_BE_COLLECTED,
    3: MANUAL_ORDER_STATUSES.COLLECTED,
    4: MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT,
    5: MANUAL_ORDER_STATUSES.DELIVERED,
    6: MANUAL_ORDER_STATUSES.RETURNED,
    7: MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT,
    8: MANUAL_ORDER_STATUSES.DELIVERY_ON_HOLD,
    11: MANUAL_ORDER_STATUSES.DROP_OFF,
};

const CANCELLABLE_EASYPARCEL_STATUSES = new Set([
    MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT,
    MANUAL_ORDER_STATUSES.TO_BE_COLLECTED,
    MANUAL_ORDER_STATUSES.DROP_OFF,
]);

const COD_STATUSES = {
    NOT_APPLICABLE: "COD_NOT_APPLICABLE",
    PENDING_COLLECTION: "COD_PENDING_COLLECTION",
    COLLECTED_BY_COURIER: "COD_COLLECTED_BY_COURIER",
    SETTLEMENT_PENDING: "COD_SETTLEMENT_PENDING",
    DELIVERED_PENDING_SETTLEMENT: "COD_DELIVERED_PENDING_SETTLEMENT",
    READY_TO_PAYOUT: "COD_READY_TO_PAYOUT",
    PAID_TO_COMPANY: "COD_PAID_TO_COMPANY",
    FAILED_OR_RETURNED: "COD_FAILED_OR_RETURNED",
};

const FINAL_SHIPMENT_STATUSES = new Set([
    MANUAL_ORDER_STATUSES.DELIVERED,
    MANUAL_ORDER_STATUSES.RETURNED,
]);

const normalizeManualStatus = (value, fallback = MANUAL_ORDER_STATUSES.CREATED) => {
    const raw = normalizeString(value).toUpperCase().replace(/[\s-]+/g, "_");
    if (!raw) return fallback;
    const legacy = {
        PUSHING: MANUAL_ORDER_STATUSES.BOOKING_PENDING,
        PUSHED: MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT,
        SHIPMENT_BOOKED: MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT,
        AWB_READY: MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT,
        PENDING_AWB: MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT,
        PENDING_PICKUP: MANUAL_ORDER_STATUSES.TO_BE_COLLECTED,
        PENDING_COLLECTION: MANUAL_ORDER_STATUSES.TO_BE_COLLECTED,
        DROPPED_OFF: MANUAL_ORDER_STATUSES.DROP_OFF,
        IN_TRANSIT: MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT,
        DELIVERY_ATTEMPTED: MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT,
        ON_HOLD: MANUAL_ORDER_STATUSES.DELIVERY_ON_HOLD,
        RETURNED_TO_SENDER: MANUAL_ORDER_STATUSES.RETURNED,
        FAILED: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
        WITHDRAWN: MANUAL_ORDER_STATUSES.CANCELLED,
        CANCEL: MANUAL_ORDER_STATUSES.CANCELLED,
        CANCELLED: MANUAL_ORDER_STATUSES.CANCELLED,
        CREATED: MANUAL_ORDER_STATUSES.CREATED,
    };
    if (legacy[raw]) return legacy[raw];
    return Object.values(MANUAL_ORDER_STATUSES).includes(raw) ? raw : fallback;
};

const normalizePaymentType = (value) => {
    const upper = normalizeString(value || "PREPAID").toUpperCase();
    return upper === "COD" ? "COD" : "PREPAID";
};

const statusLabel = (status) => {
    const labels = {
        CREATED: "Created",
        BOOKING_PENDING: "Booking Pending",
        BOOKING_FAILED: "Booking Failed",
        SCHEDULE_IN_ARRANGEMENT: "Schedule In Arrangement",
        TO_BE_COLLECTED: "To Be Collected",
        DROP_OFF: "Drop Off",
        COLLECTED: "Collected",
        DELIVERY_IN_TRANSIT: "Delivery In Transit",
        DELIVERY_ON_HOLD: "Delivery On Hold",
        DELIVERED: "Delivered",
        RETURNED: "Returned",
        CANCELLED: "Cancelled",
    };
    return labels[normalizeManualStatus(status)] || status || "Created";
};

const easyParcelStatusCodeToManual = (value) => {
    if (value === undefined || value === null || value === "") return "";
    const code = Number(value);
    return Object.prototype.hasOwnProperty.call(EASY_PARCEL_STATUS_CODE_MAP, code) ? EASY_PARCEL_STATUS_CODE_MAP[code] : "";
};

const normalizeEasyParcelTrackingStatus = (rawStatus, rawCode = null) => {
    const raw = normalizeString(rawStatus).toLowerCase();
    if (raw.includes("cancel")) return MANUAL_ORDER_STATUSES.CANCELLED;
    if (raw.includes("delivered") || raw.includes("recipient") || raw.includes("completed")) return MANUAL_ORDER_STATUSES.DELIVERED;
    if (raw.includes("return")) return MANUAL_ORDER_STATUSES.RETURNED;
    if (raw.includes("hold")) return MANUAL_ORDER_STATUSES.DELIVERY_ON_HOLD;
    if (raw.includes("transit")) return MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT;
    if (raw.includes("drop")) return MANUAL_ORDER_STATUSES.DROP_OFF;
    if (raw.includes("collected")) return MANUAL_ORDER_STATUSES.COLLECTED;
    if (raw.includes("to be collected") || (raw.includes("pending") && raw.includes("collection"))) return MANUAL_ORDER_STATUSES.TO_BE_COLLECTED;
    if (raw.includes("schedule") || raw.includes("arrangement") || raw.includes("awaiting parcel") || raw.includes("data submitted")) return MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT;
    const byCode = easyParcelStatusCodeToManual(rawCode);
    if (byCode) return byCode;
    return "";
};

const inferEasyParcelStatusFromSubmit = (submit = {}) => {
    const normalized = normalizeEasyParcelTrackingStatus(
        submit.latestTrackingStatus || submit.status || submit.raw?.latest_tracking_status || submit.raw?.status || submit.remarks,
        submit.latestShipmentStatusCode || submit.raw?.latest_shipment_status_code || submit.raw?.shipment_status_code
    );
    if (normalized) return normalized;
    if (submit.awb || submit.awbLink || submit.shipmentNumber || submit.orderNumber) {
        return MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT;
    }
    return MANUAL_ORDER_STATUSES.CREATED;
};

const getManualOrderStatusOptions = () => [
    { value: MANUAL_ORDER_STATUSES.CREATED, label: "Created", group: "Order" },
    { value: MANUAL_ORDER_STATUSES.BOOKING_PENDING, label: "Booking Pending", group: "Order" },
    { value: MANUAL_ORDER_STATUSES.BOOKING_FAILED, label: "Booking Failed", group: "Order" },
    { value: MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT, label: "Schedule In Arrangement", group: "Pending AWB" },
    { value: MANUAL_ORDER_STATUSES.TO_BE_COLLECTED, label: "To Be Collected", group: "On Going" },
    { value: MANUAL_ORDER_STATUSES.DROP_OFF, label: "Drop Off", group: "On Going" },
    { value: MANUAL_ORDER_STATUSES.COLLECTED, label: "Collected", group: "On Going" },
    { value: MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT, label: "Delivery In Transit", group: "On Going" },
    { value: MANUAL_ORDER_STATUSES.DELIVERY_ON_HOLD, label: "Delivery On Hold", group: "On Going" },
    { value: MANUAL_ORDER_STATUSES.DELIVERED, label: "Delivered", group: "Completed" },
    { value: MANUAL_ORDER_STATUSES.RETURNED, label: "Returned", group: "Completed" },
    { value: MANUAL_ORDER_STATUSES.CANCELLED, label: "Cancelled", group: "Cancelled" },
    { value: "ALL", label: "All", group: "All" },
];

const MALAYSIA_SUBDIVISION_ALIASES = {
    "MY-01": "MY-01", JOHOR: "MY-01",
    "MY-02": "MY-02", KEDAH: "MY-02",
    "MY-03": "MY-03", KELANTAN: "MY-03",
    "MY-04": "MY-04", MELAKA: "MY-04", MALACCA: "MY-04",
    "MY-05": "MY-05", NEGERISEMBILAN: "MY-05", "NEGERI SEMBILAN": "MY-05",
    "MY-06": "MY-06", PAHANG: "MY-06",
    "MY-07": "MY-07", PULAUPINANG: "MY-07", "PULAU PINANG": "MY-07", PENANG: "MY-07",
    "MY-08": "MY-08", PERAK: "MY-08",
    "MY-09": "MY-09", PERLIS: "MY-09",
    "MY-10": "MY-10", SELANGOR: "MY-10",
    "MY-11": "MY-11", TERENGGANU: "MY-11",
    "MY-12": "MY-12", SABAH: "MY-12",
    "MY-13": "MY-13", SARAWAK: "MY-13",
    "MY-14": "MY-14", KUALALUMPUR: "MY-14", "KUALA LUMPUR": "MY-14", WPKUALALUMPUR: "MY-14", "WP KUALA LUMPUR": "MY-14", WILAYAHPERSEKUTUANKUALALUMPUR: "MY-14", "WILAYAH PERSEKUTUAN KUALA LUMPUR": "MY-14",
    "MY-15": "MY-15", LABUAN: "MY-15", WPLABUAN: "MY-15", "WP LABUAN": "MY-15",
    "MY-16": "MY-16", PUTRAJAYA: "MY-16", WPPUTRAJAYA: "MY-16", "WP PUTRAJAYA": "MY-16",
};

const SINGAPORE_SUBDIVISION_ALIASES = {
    "SG-01": "SG-01", CENTRALSINGAPORE: "SG-01", "CENTRAL SINGAPORE": "SG-01", CENTRAL: "SG-01",
    "SG-02": "SG-02", NORTHEAST: "SG-02", "NORTH EAST": "SG-02",
    "SG-03": "SG-03", NORTHWEST: "SG-03", "NORTH WEST": "SG-03",
    "SG-04": "SG-04", SOUTHEAST: "SG-04", "SOUTH EAST": "SG-04",
    "SG-05": "SG-05", SOUTHWEST: "SG-05", "SOUTH WEST": "SG-05",
};

const moneyNumber = (value) => {
    if (value === undefined || value === null) return 0;
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
};

const getEasyParcelConfig = (originCountryRaw) => {
    const country = normalizeCountryCode(originCountryRaw, "MY");
    const details = EASY_PARCEL_SUPPORTED_COUNTRIES[country];
    if (!details) {
        return {
            supported: false,
            country,
            message: "EasyParcel Open API is enabled only for Malaysia, Singapore, Thailand and Indonesia manual orders in this ERP.",
        };
    }

    const prefix = `EASYPARCEL_${country}`;
    const mode = normalizeString(process.env.EASYPARCEL_MODE || process.env.EASYPARCEL_ENV || "sandbox").toLowerCase();

    return {
        ...details,
        country,
        supported: true,
        mode,
        apiBaseUrl: getEnv(`${prefix}_API_BASE_URL`, "EASYPARCEL_API_BASE_URL") || EASY_PARCEL_API_BASE_URL,
        openApiVersion: getEnv(`${prefix}_OPEN_API_VERSION`, "EASYPARCEL_OPEN_API_VERSION") || EASY_PARCEL_OPEN_API_VERSION,
        authUrl: getEnv(`${prefix}_AUTH_URL`, "EASYPARCEL_AUTH_URL") || EASY_PARCEL_AUTH_URL,
        tokenUrl: getEnv(`${prefix}_TOKEN_URL`, "EASYPARCEL_TOKEN_URL") || EASY_PARCEL_TOKEN_URL,
        submitPath: getEnv(`${prefix}_SUBMIT_PATH`, "EASYPARCEL_SUBMIT_PATH") || "/shipment/submit_orders",
        trackingPath: getEnv(`${prefix}_TRACKING_PATH`, "EASYPARCEL_TRACKING_PATH"),
        clientId: getEnv(`${prefix}_CLIENT_ID`, "EASYPARCEL_CLIENT_ID"),
        clientSecret: getEnv(`${prefix}_CLIENT_SECRET`, "EASYPARCEL_CLIENT_SECRET"),
        redirectUri: getEnv(`${prefix}_REDIRECT_URI`, "EASYPARCEL_REDIRECT_URI"),
        accessToken: getEnv(`${prefix}_ACCESS_TOKEN`, "EASYPARCEL_ACCESS_TOKEN"),
        refreshToken: getEnv(`${prefix}_REFRESH_TOKEN`, "EASYPARCEL_REFRESH_TOKEN"),
        tokenExpiresAt: getEnv(`${prefix}_TOKEN_EXPIRES_AT`, "EASYPARCEL_TOKEN_EXPIRES_AT"),
    };
};

const getAfterShipConfig = (originCountryRaw = "MY") => {
    const country = normalizeCountryCode(originCountryRaw, "MY");
    const details = AFTERSHIP_SUPPORTED_COUNTRIES[country];
    if (!details) {
        return {
            supported: false,
            country,
            message: "AfterShip manual orders support PH, VN, TH, ID, MY and SG only.",
        };
    }

    const prefix = `AFTERSHIP_${country}`;
    const mode = normalizeString(process.env.AFTERSHIP_MODE || process.env.AFTERSHIP_ENV || "sandbox").toLowerCase();
    const defaultShippingBaseUrl = mode === "production" || mode === "prod"
        ? AFTERSHIP_SHIPPING_PRODUCTION_BASE_URL
        : AFTERSHIP_SHIPPING_SANDBOX_BASE_URL;

    return {
        ...details,
        country,
        supported: true,
        mode,
        apiKey: getEnv(`${prefix}_API_KEY`, "AFTERSHIP_API_KEY"),
        shippingBaseUrl: (getEnv(`${prefix}_SHIPPING_API_BASE_URL`, "AFTERSHIP_SHIPPING_API_BASE_URL") || defaultShippingBaseUrl).replace(/\/+$/, ""),
        trackingBaseUrl: (getEnv(`${prefix}_TRACKING_API_BASE_URL`, "AFTERSHIP_TRACKING_API_BASE_URL") || AFTERSHIP_TRACKING_BASE_URL).replace(/\/+$/, ""),
        defaultShipperAccountId: getEnv(`${prefix}_SHIPPER_ACCOUNT_ID`, "AFTERSHIP_SHIPPER_ACCOUNT_ID"),
        defaultCourierSlug: getEnv(`${prefix}_COURIER_SLUG`, "AFTERSHIP_COURIER_SLUG"),
        defaultServiceType: getEnv(`${prefix}_SERVICE_TYPE`, "AFTERSHIP_SERVICE_TYPE"),
    };
};

const ensureAfterShipConfigured = (config) => {
    if (!config?.supported) {
        const err = new Error(config?.message || "AfterShip is not supported for this country.");
        err.statusCode = 400;
        throw err;
    }
    if (!config.apiKey) {
        const err = new Error(`AfterShip API key missing for ${config.country}. Set AFTERSHIP_${config.country}_API_KEY or AFTERSHIP_API_KEY in backend .env.`);
        err.statusCode = 400;
        throw err;
    }
};

const getAfterShipConfigStatus = ({ country = "MY" } = {}) => {
    const config = getAfterShipConfig(country);
    return {
        supported: Boolean(config.supported),
        country: config.country,
        name: config.name,
        currency: config.currency,
        mode: config.mode,
        apiKeySet: Boolean(config.apiKey),
        apiKeyPreview: maskSecret(config.apiKey),
        shippingBaseUrl: config.shippingBaseUrl,
        trackingBaseUrl: config.trackingBaseUrl,
        defaultShipperAccountId: config.defaultShipperAccountId || "",
        defaultCourierSlug: config.defaultCourierSlug || "",
        defaultServiceType: config.defaultServiceType || "",
        supportedCountries: Object.values(AFTERSHIP_SUPPORTED_COUNTRIES).map((item) => ({
            country: item.code,
            alpha3: item.alpha3,
            name: item.name,
            currency: item.currency,
        })),
    };
};

const updateAfterShipApiKey = ({ country = "MY", apiKey, api_key, shipperAccountId, shipper_account_id, courierSlug, courier_slug, serviceType, service_type, mode, persist = false } = {}) => {
    const config = getAfterShipConfig(country);
    if (!config.supported) {
        const err = new Error(config.message);
        err.statusCode = 400;
        throw err;
    }
    const key = normalizeString(apiKey || api_key);
    if (!key) {
        const err = new Error("AfterShip apiKey is required.");
        err.statusCode = 400;
        throw err;
    }
    const values = {
        [`AFTERSHIP_${config.country}_API_KEY`]: key,
    };
    const account = normalizeString(shipperAccountId || shipper_account_id);
    const slug = normalizeString(courierSlug || courier_slug);
    const type = normalizeString(serviceType || service_type);
    const envMode = normalizeString(mode);
    if (account) values[`AFTERSHIP_${config.country}_SHIPPER_ACCOUNT_ID`] = account;
    if (slug) values[`AFTERSHIP_${config.country}_COURIER_SLUG`] = slug;
    if (type) values[`AFTERSHIP_${config.country}_SERVICE_TYPE`] = type;
    if (envMode) values.AFTERSHIP_MODE = envMode;

    updateProcessEnvValues(values);
    const persisted = normalizeBool(persist, false);
    if (persisted) persistEnvValues(values);

    return {
        ...getAfterShipConfigStatus({ country: config.country }),
        persisted,
        message: persisted
            ? `AfterShip ${config.country} settings saved to backend .env.`
            : `AfterShip ${config.country} settings updated for current server process.`,
    };
};

const easyParcelTokenCache = new Map();

const maskSecret = (value) => {
    const normalized = normalizeString(value);
    if (!normalized) return "";
    if (normalized.length <= 8) return "********";
    return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
};

const updateProcessEnvValues = (values = {}) => {
    Object.entries(values).forEach(([key, value]) => {
        const normalized = normalizeString(value);
        if (normalized) process.env[key] = normalized;
    });
};

const persistEnvValues = (values = {}) => {
    const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
    const lines = existing ? existing.split(/\r?\n/) : [];
    const used = new Set();
    const nextLines = lines.map((line) => {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
        if (!match || !Object.prototype.hasOwnProperty.call(values, match[1])) return line;
        used.add(match[1]);
        return `${match[1]}=${values[match[1]]}`;
    });

    Object.entries(values).forEach(([key, value]) => {
        if (!used.has(key) && normalizeString(value)) nextLines.push(`${key}=${value}`);
    });

    fs.writeFileSync(ENV_PATH, nextLines.join("\n").replace(/\n*$/, "\n"));
};

const parseEasyParcelExpiry = (value, fallbackSeconds = 0) => {
    const raw = normalizeString(value);
    if (!raw) return fallbackSeconds > 0 ? Date.now() + fallbackSeconds * 1000 : 0;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
        if (numeric > 1000000000000) return numeric;
        if (numeric > 1000000000) return numeric * 1000;
        return Date.now() + numeric * 1000;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const readEasyParcelTokenCache = (config) => {
    const key = config.country;
    const cached = easyParcelTokenCache.get(key);
    if (cached) return cached;
    const seeded = {
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        expiresAt: parseEasyParcelExpiry(config.tokenExpiresAt),
    };
    easyParcelTokenCache.set(key, seeded);
    return seeded;
};

const writeEasyParcelTokenCache = (config, tokenPayload = {}) => {
    const existing = readEasyParcelTokenCache(config);
    const expiresIn = Number(tokenPayload.expires_in || tokenPayload.expiresIn || 0);
    const next = {
        accessToken: normalizeString(tokenPayload.access_token || tokenPayload.accessToken || existing.accessToken),
        refreshToken: normalizeString(tokenPayload.refresh_token || tokenPayload.refreshToken || existing.refreshToken),
        expiresAt: parseEasyParcelExpiry(tokenPayload.expires_at || tokenPayload.expiresAt, expiresIn),
    };
    easyParcelTokenCache.set(config.country, next);
    updateProcessEnvValues({
        [`EASYPARCEL_${config.country}_ACCESS_TOKEN`]: next.accessToken,
        [`EASYPARCEL_${config.country}_REFRESH_TOKEN`]: next.refreshToken,
        [`EASYPARCEL_${config.country}_TOKEN_EXPIRES_AT`]: next.expiresAt ? new Date(next.expiresAt).toISOString() : "",
    });
    return next;
};

const toEasyParcelTokenApi = (config, token, persisted = false) => ({
    country: config.country,
    accessTokenSet: Boolean(token.accessToken),
    refreshTokenSet: Boolean(token.refreshToken),
    accessTokenPreview: maskSecret(token.accessToken),
    refreshTokenPreview: maskSecret(token.refreshToken),
    expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : null,
    persisted,
});

const updateEasyParcelTokens = ({ country = "MY", accessToken, access_token, refreshToken, refresh_token, tokenExpiresAt, token_expires_at, expiresIn, expires_in, persist = false } = {}) => {
    const config = getEasyParcelConfig(country);
    ensureEasyParcelOpenApiConfigured(config);
    const nextAccessToken = accessToken || access_token;
    const nextRefreshToken = refreshToken || refresh_token;
    const nextExpiresAt = tokenExpiresAt || token_expires_at;
    const nextExpiresIn = expiresIn || expires_in;

    if (!nextAccessToken && !nextRefreshToken) {
        const err = new Error("accessToken or refreshToken is required.");
        err.statusCode = 400;
        throw err;
    }

    const token = writeEasyParcelTokenCache(config, {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        expiresAt: nextExpiresAt,
        expiresIn: nextExpiresIn,
    });

    if (normalizeBool(persist, false)) {
        persistEnvValues({
            [`EASYPARCEL_${config.country}_ACCESS_TOKEN`]: token.accessToken,
            [`EASYPARCEL_${config.country}_REFRESH_TOKEN`]: token.refreshToken,
            [`EASYPARCEL_${config.country}_TOKEN_EXPIRES_AT`]: token.expiresAt ? new Date(token.expiresAt).toISOString() : "",
        });
        return toEasyParcelTokenApi(config, token, true);
    }

    return toEasyParcelTokenApi(config, token, false);
};

const ensureEasyParcelOpenApiConfigured = (config) => {
    if (!config?.supported) {
        const err = new Error(config?.message || "EasyParcel is not supported for this origin country");
        err.statusCode = 400;
        throw err;
    }
    if (!config.clientId || !config.clientSecret) {
        const err = new Error(`EasyParcel Open API Client ID/Client Secret missing for ${config.country}. Set EASYPARCEL_${config.country}_CLIENT_ID and EASYPARCEL_${config.country}_CLIENT_SECRET in backend .env.`);
        err.statusCode = 400;
        throw err;
    }
};

const requestEasyParcelToken = async (config, formFields) => {
    ensureEasyParcelOpenApiConfigured(config);
    const body = new URLSearchParams();
    Object.entries(formFields).forEach(([key, value]) => {
        if (value !== undefined && value !== null && normalizeString(value)) body.append(key, value);
    });

    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const response = await axios.post(config.tokenUrl, body.toString(), {
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        timeout: EASY_PARCEL_TIMEOUT_MS,
    });
    const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    if (!data?.access_token && !data?.accessToken) {
        const err = new Error(data?.message || "EasyParcel token response did not include an access token.");
        err.statusCode = 502;
        err.easyParcelResponse = data;
        throw err;
    }
    return writeEasyParcelTokenCache(config, data);
};

const refreshEasyParcelToken = async (config) => {
    const cached = readEasyParcelTokenCache(config);
    if (!cached.refreshToken) {
        const err = new Error(`EasyParcel ${config.country} account is connected in Developer Hub, but backend refresh/access token is missing. Generate/authorize the app and store EASYPARCEL_${config.country}_REFRESH_TOKEN or EASYPARCEL_${config.country}_ACCESS_TOKEN in backend .env.`);
        err.statusCode = 400;
        throw err;
    }
    const token = await requestEasyParcelToken(config, {
        grant_type: "refresh_token",
        refresh_token: cached.refreshToken,
        redirect_uri: config.redirectUri,
    });
    persistEnvValues({
        [`EASYPARCEL_${config.country}_ACCESS_TOKEN`]: token.accessToken,
        [`EASYPARCEL_${config.country}_REFRESH_TOKEN`]: token.refreshToken,
        [`EASYPARCEL_${config.country}_TOKEN_EXPIRES_AT`]: token.expiresAt ? new Date(token.expiresAt).toISOString() : "",
    });
    return token;
};

const getEasyParcelAccessToken = async (config) => {
    ensureEasyParcelOpenApiConfigured(config);
    const cached = readEasyParcelTokenCache(config);
    if (cached.accessToken && (!cached.expiresAt || cached.expiresAt - Date.now() > EASY_PARCEL_TOKEN_REFRESH_SKEW_MS)) {
        return cached.accessToken;
    }
    const refreshed = await refreshEasyParcelToken(config);
    return refreshed.accessToken;
};

const extractEasyParcelOpenApiError = (error) => {
    const data = error?.response?.data;
    if (!data) return error.message || "EasyParcel Open API request failed";
    if (typeof data === "string") return data;
    if (data.message) return data.message;
    if (data.error_description) return data.error_description;
    if (data.error) return typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (Array.isArray(data.errors)) return data.errors.map((item) => item.message || item.error || JSON.stringify(item)).join("; ");
    return JSON.stringify(data);
};

const callEasyParcelOpenApi = async (config, { method = "POST", path, data, fallbackPaths = [] }, didRefresh = false) => {
    const token = await getEasyParcelAccessToken(config);
    const normalizedBase = (config.apiBaseUrl || EASY_PARCEL_API_BASE_URL).replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    try {
        const response = await axios({
            method,
            url: `${normalizedBase}${normalizedPath}`,
            data,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            timeout: EASY_PARCEL_TIMEOUT_MS,
        });
        return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    } catch (error) {
        if ((error?.response?.status === 401 || error?.response?.status === 403) && !didRefresh) {
            await refreshEasyParcelToken(config);
            return callEasyParcelOpenApi(config, { method, path, data, fallbackPaths }, true);
        }
        if (error?.response?.status === 404 && fallbackPaths.length) {
            const [nextPath, ...rest] = fallbackPaths;
            return callEasyParcelOpenApi(config, { method, path: nextPath, data, fallbackPaths: rest }, didRefresh);
        }
        const err = new Error(extractEasyParcelOpenApiError(error));
        err.statusCode = error?.response?.status || 502;
        err.easyParcelResponse = error?.response?.data || null;
        throw err;
    }
};

const extractAfterShipError = (error) => {
    const data = error?.response?.data;
    if (!data) return error.message || "AfterShip API request failed";
    if (typeof data === "string") return data;
    const meta = data.meta || data;
    if (meta.message) return meta.message;
    if (meta.error_message) return meta.error_message;
    if (meta.code && meta.type) return `${meta.type}: ${meta.code}`;
    if (data.error) return typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (Array.isArray(data.errors)) return data.errors.map((item) => item.message || item.error || JSON.stringify(item)).join("; ");
    return JSON.stringify(data);
};

const callAfterShipApi = async (config, { method = "GET", path, data, query = null, product = "shipping" }) => {
    ensureAfterShipConfigured(config);
    const baseUrl = product === "tracking" ? config.trackingBaseUrl : config.shippingBaseUrl;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    try {
        const response = await axios({
            method,
            url: `${baseUrl}${normalizedPath}`,
            params: query || undefined,
            data,
            headers: {
                "as-api-key": config.apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            timeout: AFTERSHIP_TIMEOUT_MS,
        });
        return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    } catch (error) {
        const err = new Error(extractAfterShipError(error));
        err.statusCode = error?.response?.status || 502;
        err.afterShipResponse = error?.response?.data || null;
        throw err;
    }
};

const normalizeSubdivisionCode = (value, country, fallback = "") => {
    const raw = normalizeString(value);
    if (!raw) return fallback;
    const upper = raw.toUpperCase();
    if (/^[A-Z]{2}-[0-9A-Z]{2}$/.test(upper)) return upper;
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    const aliasSource = country === "MY" ? MALAYSIA_SUBDIVISION_ALIASES : SINGAPORE_SUBDIVISION_ALIASES;
    return aliasSource[upper] || aliasSource[compact] || fallback;
};

const sanitizePhoneNumber = (phone, country) => {
    let digits = normalizeString(phone).replace(/[^0-9]/g, "");
    if (country === "MY" && digits.startsWith("60") && digits.length > 9) digits = digits.slice(2);
    if (country === "SG" && digits.startsWith("65") && digits.length > 8) digits = digits.slice(2);
    digits = digits.replace(/^0+/, "") || digits;
    return digits;
};

const buildEasyParcelLoginUrl = ({ country = "MY", state = "" } = {}) => {
    const config = getEasyParcelConfig(country);
    ensureEasyParcelOpenApiConfigured(config);
    if (!config.redirectUri) {
        const err = new Error(`EasyParcel redirect URI missing for ${config.country}. Set EASYPARCEL_${config.country}_REDIRECT_URI in backend .env and in Developer Hub Allowed Redirect URIs.`);
        err.statusCode = 400;
        throw err;
    }
    const url = new URL(config.authUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    if (state) url.searchParams.set("state", state);
    return { country: config.country, authUrl: url.toString(), redirectUri: config.redirectUri };
};

const exchangeEasyParcelAuthorizationCode = async ({ country = "MY", code, state = "", persist = false }) => {
    const config = getEasyParcelConfig(country);
    if (!code) {
        const err = new Error("EasyParcel authorization code is required.");
        err.statusCode = 400;
        throw err;
    }
    const token = await requestEasyParcelToken(config, {
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        state,
    });
    const persisted = normalizeBool(persist, false);
    if (persisted) {
        persistEnvValues({
            [`EASYPARCEL_${config.country}_ACCESS_TOKEN`]: token.accessToken,
            [`EASYPARCEL_${config.country}_REFRESH_TOKEN`]: token.refreshToken,
            [`EASYPARCEL_${config.country}_TOKEN_EXPIRES_AT`]: token.expiresAt ? new Date(token.expiresAt).toISOString() : "",
        });
    }
    return {
        country: config.country,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenStatus: toEasyParcelTokenApi(config, token, persisted),
        expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : null,
        accessTokenEnv: `EASYPARCEL_${config.country}_ACCESS_TOKEN`,
        refreshTokenEnv: `EASYPARCEL_${config.country}_REFRESH_TOKEN`,
        tokenExpiresAtEnv: `EASYPARCEL_${config.country}_TOKEN_EXPIRES_AT`,
        message: persisted
            ? `EasyParcel ${config.country} token exchange successful and saved to backend .env.`
            : `EasyParcel ${config.country} token exchange successful. Pass persist=true to save tokens to backend .env.`,
    };
};

const refreshEasyParcelAccountToken = async ({ country = "MY", persist = false } = {}) => {
    const config = getEasyParcelConfig(country);
    const token = await refreshEasyParcelToken(config);
    const persisted = normalizeBool(persist, false);
    if (persisted) {
        persistEnvValues({
            [`EASYPARCEL_${config.country}_ACCESS_TOKEN`]: token.accessToken,
            [`EASYPARCEL_${config.country}_REFRESH_TOKEN`]: token.refreshToken,
            [`EASYPARCEL_${config.country}_TOKEN_EXPIRES_AT`]: token.expiresAt ? new Date(token.expiresAt).toISOString() : "",
        });
    }

    return {
        ...toEasyParcelTokenApi(config, token, persisted),
        message: persisted
            ? `EasyParcel ${config.country} token refreshed and saved to backend .env.`
            : `EasyParcel ${config.country} token refreshed for current server process.`,
    };
};

const getWarehouseSender = (warehouse = {}, sender = {}) => ({
    senderName: normalizeString(sender.senderName || sender.name || warehouse.manager_name || warehouse.name || "Warehouse"),
    company: normalizeString(sender.company || sender.companyName || warehouse.name || ""),
    phone: normalizeString(sender.phone || sender.contact || sender.mobile || warehouse.phone || ""),
    email: normalizeString(sender.email || warehouse.email || ""),
    address: normalizeString(sender.address || sender.addr1 || warehouse.location || ""),
    city: normalizeString(sender.city || warehouse.city || ""),
    state: normalizeString(sender.state || sender.province || warehouse.state || ""),
    postcode: normalizeString(sender.postcode || sender.zipCode || sender.zip_code || sender.code || warehouse.postcode || warehouse.postal_code || ""),
    country: normalizeCountryCode(sender.country || warehouse.country || "MY", "MY"),
    unit: normalizeString(sender.unit || sender.pickUnit || ""),
});

const getBuyerReceiver = (buyer = {}, fallbackCountry = "MY") => ({
    name: normalizeString(buyer.buyerName || buyer.name || "Customer"),
    company: normalizeString(buyer.company || buyer.companyName || ""),
    phone: normalizeString(buyer.phone || buyer.contact || buyer.mobile || ""),
    email: normalizeString(buyer.email || buyer.sendEmail || ""),
    address: normalizeString(buyer.address || buyer.addr1 || ""),
    city: normalizeString(buyer.city || ""),
    state: normalizeString(buyer.state || buyer.province || ""),
    postcode: normalizeString(buyer.zipCode || buyer.zip_code || buyer.postcode || buyer.code || ""),
    country: normalizeCountryCode(buyer.country || fallbackCountry, fallbackCountry),
    unit: normalizeString(buyer.unit || buyer.sendUnit || ""),
});

const getRateRequestFromQuery = ({ query = {}, warehouse = {} }) => {
    const sender = getWarehouseSender(warehouse, {
        senderName: query.senderName,
        company: query.senderCompany,
        phone: query.senderPhone,
        address: query.senderAddress,
        city: query.senderCity,
        state: query.senderState || query.pickState,
        postcode: query.senderPostcode || query.pickPostcode,
        country: query.senderCountry || query.pickCountry,
        unit: query.senderUnit,
        email: query.senderEmail,
    });
    const receiver = getBuyerReceiver({
        name: query.buyerName,
        phone: query.phone,
        email: query.email,
        address: query.address,
        city: query.city,
        state: query.state || query.sendState,
        zipCode: query.zipCode || query.postcode || query.sendPostcode,
        country: query.country || query.sendCountry,
        unit: query.unit,
    }, sender.country);
    return { sender, receiver };
};

const validateRateAddress = ({ config, sender, receiver }) => {
    if (!config.supported) return config.message || "EasyParcel is not supported for this origin country.";
    if (!sender.postcode || !receiver.postcode) return "Sender and receiver postcode are required for EasyParcel rate lookup.";
    if (!sender.country || !receiver.country) return "Sender and receiver country are required for EasyParcel rate lookup.";
    if (!EASY_PARCEL_SUPPORTED_COUNTRIES[sender.country] || !EASY_PARCEL_SUPPORTED_COUNTRIES[receiver.country]) {
        return "EasyParcel manual orders currently support Malaysia, Singapore, Thailand and Indonesia only.";
    }
    if (sender.country !== receiver.country) {
        return "EasyParcel manual order booking currently supports domestic Malaysia, Singapore, Thailand or Indonesia shipments only.";
    }
    if (config.country === "MY" && (!sender.state || !receiver.state)) {
        return "Malaysia EasyParcel requires sender and receiver state code/name, for example MY-14 or Kuala Lumpur.";
    }
    return "";
};

const readFeatureValue = (features, featureName) => {
    if (!features) return null;
    if (!Array.isArray(features) && typeof features === "object") return features[featureName] || null;
    const match = (features || []).find((item) => item && Object.prototype.hasOwnProperty.call(item, featureName));
    return match ? match[featureName] : null;
};

const normalizeEasyParcelRate = (rate, index, config) => {
    const courier = rate?.courier || rate || {};
    const pricing = rate?.pricing || rate?.price || {};
    const cod = readFeatureValue(rate?.features || courier?.features, "cod") || {};
    const totalAmount = moneyNumber(pricing.total_amount || pricing.totalAmount || pricing.shipment_price || pricing.shipmentPrice || rate.total_amount || rate.price || rate.rate || rate.shipping_fee);
    const shipmentPrice = moneyNumber(pricing.shipment_price || pricing.shipmentPrice || totalAmount);
    const codAvailable = cod.available === true || normalizeString(cod.available).toLowerCase() === "true" || rate.cod_service_available === true;
    const serviceId = normalizeString(courier.service_id || courier.serviceId || rate.service_id || rate.serviceId || rate.courier_id || rate.id || index);

    return {
        id: serviceId || String(index),
        rateId: normalizeString(rate.rate_id || rate.rateId || serviceId),
        serviceId,
        serviceDetail: normalizeString(courier.service_tag || rate.service_detail || rate.serviceDetail || ""),
        courierId: normalizeString(courier.courier_id || courier.courierId || rate.courier_id || rate.courierId || ""),
        company: normalizeString(courier.courier_name || courier.courierName || rate.courier_name || rate.company || rate.courier) || "EasyParcel Courier",
        serviceName: normalizeString(courier.service_name || courier.serviceName || rate.service_name || rate.service || rate.name) || normalizeString(courier.courier_name),
        serviceType: normalizeString(courier.service_tag || rate.service_type || rate.serviceType || "parcel"),
        price: totalAmount,
        shipmentPrice,
        addonPrice: moneyNumber(pricing.addon_price || pricing.addonPrice || rate.addon_price),
        currency: normalizeString(pricing.currency || rate.currency || config.currency),
        delivery: normalizeString(courier.delivery_duration || courier.deliveryDuration || rate.delivery || rate.delivery_time || rate.estimated_delivery),
        pickupDate: normalizeString(rate.pickup_date || ""),
        scheduledStartDate: normalizeString(rate.scheduled_start_date || ""),
        logo: normalizeString(courier.courier_logo || courier.logo || rate.courier_logo || rate.logo || ""),
        codAvailable,
        codMinAmount: moneyNumber(cod.min_cod_amount || cod.minCodAmount || rate.cod_service_min_cod_amount),
        codMaxAmount: moneyNumber(cod.max_cod_amount || cod.maxCodAmount || rate.cod_service_max_cod_amount),
        raw: rate,
    };
};

const toAfterShipCountry = (country, fallback = "MY") => {
    const normalized = normalizeCountryCode(country, fallback);
    return AFTERSHIP_SUPPORTED_COUNTRIES[normalized]?.alpha3 || normalized;
};

const validateAfterShipAddress = ({ config, sender, receiver }) => {
    if (!config.supported) return config.message || "AfterShip is not supported for this origin country.";
    if (!sender.country || !receiver.country) return "Sender and receiver country are required for AfterShip.";
    if (!AFTERSHIP_SUPPORTED_COUNTRIES[sender.country] || !AFTERSHIP_SUPPORTED_COUNTRIES[receiver.country]) {
        return "AfterShip manual orders support PH, VN, TH, ID, MY and SG only.";
    }
    if (sender.country !== receiver.country) {
        return "AfterShip manual order booking supports domestic shipments only. Sender and receiver country must be the same.";
    }
    if (!sender.address || !receiver.address) return "Sender and receiver address are required for AfterShip.";
    if (!sender.postcode || !receiver.postcode) return "Sender and receiver postcode are required for AfterShip.";
    if (!sender.city || !receiver.city) return "Sender and receiver city are required for AfterShip.";
    if (!sender.senderName || !receiver.name) return "Sender and receiver contact names are required for AfterShip.";
    if (!sender.phone || !receiver.phone) return "Sender and receiver phone numbers are required for AfterShip.";
    return "";
};

const toAfterShipAddress = (address = {}, fallbackCountry = "MY") => {
    const country = normalizeCountryCode(address.country, fallbackCountry);
    const [street1, street2, street3] = splitAddress(address.address, 120, 3);
    return {
        street1: street1 || normalizeString(address.address),
        street2: street2 || normalizeString(address.unit),
        street3: street3 || "",
        city: normalizeString(address.city || address.state || AFTERSHIP_SUPPORTED_COUNTRIES[country]?.name),
        state: normalizeString(address.state || address.city),
        postal_code: normalizeString(address.postcode),
        country: toAfterShipCountry(country, fallbackCountry),
        contact_name: trimMax(address.senderName || address.name || "Customer", 80),
        phone: normalizeString(address.phone),
        email: normalizeString(address.email),
        company_name: normalizeString(address.company || address.senderName || address.name),
        type: "business",
    };
};

const toAfterShipMoney = (amount, currency) => ({
    amount: Math.max(0, moneyNumber(amount)),
    currency,
});

const toAfterShipParcel = ({ dimensions, items, content, declaredValue, currency }) => {
    const itemRows = Array.isArray(items) && items.length ? items : [];
    const parcelItems = itemRows.map((item, index) => {
        const quantity = Math.max(1, Number.parseInt(item.quantity || 1, 10));
        return {
            description: trimMax(item.productName || item.name || item.sku || content || `Item ${index + 1}`, 80),
            quantity,
            price: toAfterShipMoney(item.unitPrice || item.price || item.lineTotal || declaredValue / quantity, currency),
            sku: trimMax(item.sku || item.skuName || item.productSku || "", 80),
            origin_country: toAfterShipCountry(item.originCountry || item.origin_country || "MY", "MY"),
        };
    });

    return {
        description: trimMax(content || "Product", 80),
        box_type: "custom",
        weight: {
            value: Math.max(0.01, toNumber(dimensions.weight || 0.5)),
            unit: "kg",
        },
        dimension: {
            width: Math.max(1, toNumber(dimensions.width || 1)),
            height: Math.max(1, toNumber(dimensions.height || 1)),
            depth: Math.max(1, toNumber(dimensions.length || 1)),
            unit: "cm",
        },
        items: parcelItems,
    };
};

const buildAfterShipShipment = ({ config, sender, receiver, body = {}, query = {} }) => {
    const dimensions = resolvePackageDimensions({ ...body, package: body.package || query });
    const payment = body.payment || {};
    const content = trimMax(body.afterShip?.content || body.packageContent || body.package_content || query.content || "Product", 80);
    const declaredValue = Math.max(1, moneyNumber(body.afterShip?.parcelValue || payment.orderValue || payment.subtotal || query.parcelValue || query.orderValue || 1));
    const currency = normalizeString(body.currency || query.currency || config.currency);
    return {
        ship_from: toAfterShipAddress(sender, config.country),
        ship_to: toAfterShipAddress(receiver, config.country),
        parcels: [
            toAfterShipParcel({
                dimensions,
                items: body.items || [],
                content,
                declaredValue,
                currency,
            }),
        ],
        order_id: normalizeString(body.orderId || body.order_id || body.orderNumber || query.orderId || query.order_id),
        delivery_instructions: normalizeString(body.afterShip?.deliveryInstructions || body.deliveryInstructions || query.deliveryInstructions),
    };
};

const normalizeAfterShipRate = (rate, index, config) => {
    const courier = rate.courier || {};
    const charge = rate.total_charge || rate.charge || rate.price || {};
    const amount = moneyNumber(charge.amount || rate.amount || rate.total || rate.price);
    const serviceType = normalizeString(rate.service_type || rate.serviceType || rate.service_name || rate.serviceName || config.defaultServiceType);
    const shipperAccount = rate.shipper_account || rate.shipperAccount || {};
    const courierSlug = normalizeString(courier.slug || rate.courier_slug || rate.slug || config.defaultCourierSlug);
    const rateId = normalizeString(rate.id || rate.rate_id || rate.rateId || `${courierSlug || "aftership"}-${serviceType || index}`);
    return {
        id: rateId,
        rateId,
        serviceId: serviceType || rateId,
        serviceType,
        serviceName: normalizeString(rate.service_name || rate.serviceName || serviceType || "AfterShip Service"),
        company: normalizeString(courier.name || rate.courier_name || rate.courier || courierSlug || "AfterShip Courier"),
        courierSlug,
        shipperAccountId: normalizeString(shipperAccount.id || rate.shipper_account_id || rate.shipperAccountId || config.defaultShipperAccountId),
        price: amount,
        shipmentPrice: amount,
        currency: normalizeString(charge.currency || rate.currency || config.currency),
        delivery: normalizeString(rate.delivery_date || rate.estimated_delivery_date || rate.transit_time || rate.delivery),
        codAvailable: Boolean((rate.service_options || []).some((item) => normalizeString(item.type || item.name).toLowerCase() === "cod")),
        raw: rate,
    };
};

const getAfterShipRates = async (user, query) => {
    const { Warehouse } = require("../../models");
    const companyId = resolveCompanyId(user);
    const warehouseId = Number(query.warehouseId);
    const warehouse = Number.isInteger(warehouseId) && warehouseId > 0
        ? await Warehouse.findOne({ where: { id: warehouseId, company_id: companyId }, raw: true })
        : null;

    const { sender, receiver } = getRateRequestFromQuery({ query, warehouse: warehouse || {} });
    const config = getAfterShipConfig(sender.country);
    if (!config.supported) return { configured: false, message: config.message, services: [], originCountry: config.country };
    if (!config.apiKey) {
        return { configured: false, message: `AfterShip API key missing for ${config.country}. Set AFTERSHIP_${config.country}_API_KEY or AFTERSHIP_API_KEY.`, services: [], originCountry: config.country };
    }

    const validationMessage = validateAfterShipAddress({ config, sender, receiver });
    if (validationMessage) return { configured: true, message: validationMessage, services: [], originCountry: config.country };

    const shipperAccountId = normalizeString(query.shipperAccountId || query.shipper_account_id || config.defaultShipperAccountId);
    const payload = {
        async: normalizeBool(query.async, false),
        is_document: normalizeBool(query.isDocument || query.is_document, false),
        ship_date: normalizeString(query.shipDate || query.ship_date || todayDate()),
        ...(shipperAccountId ? { shipper_accounts: [{ id: shipperAccountId }] } : {}),
        shipment: buildAfterShipShipment({ config, sender, receiver, query }),
    };

    try {
        const response = await callAfterShipApi(config, { method: "POST", path: "/rates", data: payload });
        const rows = Array.isArray(response?.data?.rates) ? response.data.rates
            : Array.isArray(response?.rates) ? response.rates
                : Array.isArray(response?.data) ? response.data
                    : [];
        const services = rows.map((rate, index) => normalizeAfterShipRate(rate, index, config)).filter((rate) => rate.rateId || rate.serviceType);
        return {
            configured: true,
            originCountry: config.country,
            currency: config.currency,
            mode: config.mode,
            services,
            message: services.length ? "" : "No AfterShip courier service found for this route/account.",
            raw: response,
        };
    } catch (err) {
        return {
            configured: true,
            originCountry: config.country,
            message: err.message || "AfterShip rates request failed",
            services: [],
            afterShipError: err.message,
        };
    }
};

const listAfterShipCouriers = async (user, query = {}) => {
    resolveCompanyId(user);
    const config = getAfterShipConfig(query.country || "MY");
    const response = await callAfterShipApi(config, { method: "GET", path: "/couriers" });
    const couriers = Array.isArray(response?.data?.couriers) ? response.data.couriers
        : Array.isArray(response?.couriers) ? response.couriers
            : Array.isArray(response?.data) ? response.data
                : [];
    return {
        country: config.country,
        mode: config.mode,
        couriers,
        raw: response,
    };
};

const listAfterShipShipperAccounts = async (user, query = {}) => {
    resolveCompanyId(user);
    const config = getAfterShipConfig(query.country || "MY");
    const response = await callAfterShipApi(config, {
        method: "GET",
        path: "/shipper-accounts",
        query: {
            slug: normalizeString(query.slug || query.courierSlug || query.courier_slug) || undefined,
            limit: query.limit || undefined,
            next_token: query.nextToken || query.next_token || undefined,
        },
    });
    const accounts = Array.isArray(response?.data?.shipper_accounts) ? response.data.shipper_accounts
        : Array.isArray(response?.shipper_accounts) ? response.shipper_accounts
            : Array.isArray(response?.data) ? response.data
                : [];
    return {
        country: config.country,
        mode: config.mode,
        accounts,
        nextToken: response?.data?.next_token || response?.next_token || null,
        raw: response,
    };
};

const buildQuotationShipment = ({ config, sender, receiver, query }) => ({
    sender: {
        postcode: sender.postcode,
        subdivision_code: normalizeSubdivisionCode(sender.state, config.country, config.defaultSubdivision),
        country: sender.country,
    },
    receiver: {
        postcode: receiver.postcode,
        subdivision_code: normalizeSubdivisionCode(receiver.state, config.country, config.defaultSubdivision),
        country: receiver.country,
    },
    parcel_value: Math.max(1, moneyNumber(query.parcelValue || query.orderValue || 1)),
    weight: Math.max(0.1, toNumber(query.weight || 0.5)),
    width: Math.max(1, toNumber(query.width || 1)),
    length: Math.max(1, toNumber(query.length || 1)),
    height: Math.max(1, toNumber(query.height || 1)),
});

const getEasyParcelRates = async (user, query) => {
    const { Warehouse } = require("../../models");
    const companyId = resolveCompanyId(user);
    const warehouseId = Number(query.warehouseId);
    const warehouse = Number.isInteger(warehouseId) && warehouseId > 0
        ? await Warehouse.findOne({ where: { id: warehouseId, company_id: companyId }, raw: true })
        : null;

    const { sender, receiver } = getRateRequestFromQuery({ query, warehouse: warehouse || {} });
    const config = getEasyParcelConfig(sender.country);
    if (!config.supported) return { configured: false, message: config.message, services: [], originCountry: config.country };
    if (!config.clientId || !config.clientSecret) {
        return { configured: false, message: `EasyParcel Open API Client ID/Client Secret missing for ${config.country}. Set EASYPARCEL_${config.country}_CLIENT_ID and EASYPARCEL_${config.country}_CLIENT_SECRET.`, services: [], originCountry: config.country };
    }

    const validationMessage = validateRateAddress({ config, sender, receiver });
    if (validationMessage) return { configured: true, message: validationMessage, services: [], originCountry: config.country };

    const payload = { shipment: [buildQuotationShipment({ config, sender, receiver, query })] };

    try {
        const response = await callEasyParcelOpenApi(config, {
            method: "POST",
            path: `/open_api/${config.openApiVersion}/shipment/quotations`,
            data: payload,
        });
        const first = Array.isArray(response?.data) ? response.data[0] || {} : response?.data || response || {};
        const quotations = Array.isArray(first.quotations) ? first.quotations : Array.isArray(response?.quotations) ? response.quotations : [];
        const services = quotations
            .map((rate, index) => normalizeEasyParcelRate(rate, index, config))
            .filter((rate) => rate.serviceId);

        return {
            configured: true,
            originCountry: config.country,
            currency: config.currency,
            mode: config.mode,
            services,
            message: services.length ? "" : normalizeString(first?.message || first?.remarks || "No EasyParcel courier service found for this route."),
            raw: response,
        };
    } catch (err) {
        return {
            configured: true,
            originCountry: config.country,
            message: err?.easyParcelResponse?.message || err.message || "EasyParcel request failed",
            services: [],
        };
    }
};

const resolvePackageDimensions = (body = {}) => {
    const pkg = body.package || body.packageData || {};
    return {
        weight: Math.max(0.1, toNumber(pkg.weight || body.packageWeight || 0.5)),
        width: Math.max(1, toNumber(pkg.width || body.packageWidth || 1)),
        length: Math.max(1, toNumber(pkg.length || body.packageLength || 1)),
        height: Math.max(1, toNumber(pkg.height || body.packageHeight || 1)),
    };
};

const normalizeManualOrderPaymentType = (payment = {}) => normalizePaymentType(payment.paymentType || payment.payment_type || payment.type || "PREPAID");

const buildSubmitOrderPayload = ({ config, warehouse = {}, body = {}, orderNumber, type }) => {
    const easyParcel = body.easyParcel || {};
    const sender = getWarehouseSender(warehouse, easyParcel.sender || body.sender || {});
    const receiver = getBuyerReceiver({ ...(body.buyer || {}), email: easyParcel.receiverEmail || body?.buyer?.email }, sender.country);
    const selectedRate = easyParcel.selectedRate || body.logisticRaw || body.logistic_raw || {};
    const serviceId = normalizeString(body.logisticServiceId || body.logistic_service_id || selectedRate.serviceId || selectedRate.service_id);
    const payment = body.payment || {};
    const paymentType = normalizeManualOrderPaymentType(payment);
    const isCod = paymentType === "COD";
    const dimensions = resolvePackageDimensions(body);
    const collectDate = normalizeString(easyParcel.collectDate || body.collectDate || body.selectDate || todayDate());
    const itemNames = Array.isArray(body.items) ? body.items.map((item) => item.productName || item.name || item.sku).filter(Boolean) : [];
    const content = trimMax(easyParcel.content || itemNames.join(", ") || (type === "gift" ? "Gift" : "Product"), 80);
    const declaredValue = Math.max(1, moneyNumber(easyParcel.parcelValue || payment.orderValue || payment.subtotal || body.orderValue || 1));
    const senderCountry = normalizeCountryCode(sender.country, "MY");
    const receiverCountry = normalizeCountryCode(receiver.country, senderCountry);
    const senderSubdivision = normalizeSubdivisionCode(sender.state, senderCountry, config.defaultSubdivision);
    const receiverSubdivision = normalizeSubdivisionCode(receiver.state, receiverCountry, config.defaultSubdivision);

    const missing = [];
    if (!serviceId) missing.push("EasyParcel service");
    if (!sender.senderName) missing.push("sender name");
    if (!sender.phone) missing.push("sender phone");
    if (!sender.address) missing.push("sender address");
    if (!sender.postcode) missing.push("sender postcode");
    if (!receiver.name) missing.push("receiver name");
    if (!receiver.phone) missing.push("receiver phone");
    if (!receiver.address) missing.push("receiver address");
    if (!receiver.postcode) missing.push("receiver postcode");
    if (!EASY_PARCEL_SUPPORTED_COUNTRIES[senderCountry] || !EASY_PARCEL_SUPPORTED_COUNTRIES[receiverCountry]) missing.push("supported country MY/SG/TH/ID");
    if (senderCountry !== receiverCountry) missing.push("same sender and receiver country");
    if (senderCountry === "MY" && !sender.state) missing.push("sender state");
    if (receiverCountry === "MY" && !receiver.state) missing.push("receiver state");
    if (missing.length) {
        const err = new Error(`Missing EasyParcel booking information: ${missing.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }

    if (isCod) {
        if (selectedRate.codAvailable === false) {
            const err = new Error("Selected EasyParcel courier service does not support COD. Choose a COD-supported service or change payment type to Prepaid.");
            err.statusCode = 400;
            throw err;
        }
        if (selectedRate.codMinAmount && declaredValue < selectedRate.codMinAmount) {
            const err = new Error(`COD amount must be at least ${selectedRate.currency || config.currency} ${selectedRate.codMinAmount}.`);
            err.statusCode = 400;
            throw err;
        }
        if (selectedRate.codMaxAmount && declaredValue > selectedRate.codMaxAmount) {
            const err = new Error(`COD amount cannot exceed ${selectedRate.currency || config.currency} ${selectedRate.codMaxAmount}.`);
            err.statusCode = 400;
            throw err;
        }
    }

    const [senderAddress1, senderAddress2] = splitAddress(sender.address, 120, 2);
    const [receiverAddress1, receiverAddress2] = splitAddress(receiver.address, 120, 2);
    const itemCurrency = config.currency;
    const items = Array.isArray(body.items) && body.items.length
        ? body.items.map((item, index) => {
            const quantity = Math.max(1, Number.parseInt(item.quantity || 1, 10));
            const itemValue = Math.max(1, moneyNumber(item.unitPrice || item.price || item.lineTotal || declaredValue / quantity));
            const itemWeightRaw = toNumber(item.weight || 0);
            const itemWeight = itemWeightRaw > 20 ? itemWeightRaw / 1000 : itemWeightRaw;
            return {
                item_category: trimMax(item.category || item.itemCategory || "Others", 50),
                content: trimMax(item.productName || item.name || item.sku || content || `Item ${index + 1}`, 80),
                value: itemValue,
                currency_code: itemCurrency,
                weight: Math.max(0.01, itemWeight || dimensions.weight / quantity),
                height: dimensions.height,
                length: dimensions.length,
                width: dimensions.width,
                quantity,
                sku: trimMax(item.sku || item.skuName || item.productSku || "", 50),
            };
        })
        : [{ item_category: "Others", content, value: declaredValue, currency_code: itemCurrency, weight: dimensions.weight, height: dimensions.height, length: dimensions.length, width: dimensions.width, quantity: 1 }];

    const feature = {
        sms_tracking: false,
        email_tracking: false,
        whatsapp_tracking: false,
        awb_branding: false,
    };
    if (isCod) {
        feature.cod = {
            cod_amount: declaredValue,
            cod_currency: config.currency,
        };
    }

    return {
        shipment: [
            {
                reference: trimMax(orderNumber, 80),
                customer_reference_no: trimMax(orderNumber, 80),
                service_id: serviceId,
                collection_date: collectDate,
                content,
                parcel_value: declaredValue,
                ...dimensions,
                item: items,
                sender: {
                    name: trimMax(sender.senderName, 80),
                    company: trimMax(sender.company || sender.senderName, 80),
                    phone_number_country_code: config.phoneCode,
                    phone_number: sanitizePhoneNumber(sender.phone, senderCountry),
                    email: sender.email || getEnv(`EASYPARCEL_${senderCountry}_SENDER_EMAIL`, "EASYPARCEL_SENDER_EMAIL"),
                    address_1: senderAddress1 || sender.address,
                    address_2: senderAddress2 || "",
                    postcode: sender.postcode,
                    city: trimMax(sender.city || sender.state || config.name, 60),
                    subdivision_code: senderSubdivision,
                    country_code: senderCountry,
                },
                receiver: {
                    name: trimMax(receiver.name, 80),
                    company: trimMax(receiver.company || receiver.name, 80),
                    phone_number_country_code: config.phoneCode,
                    phone_number: sanitizePhoneNumber(receiver.phone, receiverCountry),
                    email: receiver.email,
                    address_1: receiverAddress1 || receiver.address,
                    address_2: receiverAddress2 || "",
                    postcode: receiver.postcode,
                    city: trimMax(receiver.city || receiver.state || config.name, 60),
                    subdivision_code: receiverSubdivision,
                    country_code: receiverCountry,
                },
                feature,
            },
        ],
    };
};

const parseSubmitResult = (response) => {
    const first = Array.isArray(response?.data) ? response.data[0] || {} : response?.data || response || {};
    const orderDetails = first.order_details || first.orderDetails || {};
    const shipments = Array.isArray(first.shipments) ? first.shipments : Array.isArray(first.shipment) ? first.shipment : [];
    const shipment = shipments[0] || first.shipment || first || {};
    const pricing = shipment.pricing_breakdown || shipment.pricing || first.pricing_breakdown || {};
    const awbUrls = shipment.awb_urls_by_format || shipment.awbUrlsByFormat || {};
    const errors = [
        ...(Array.isArray(first.errors) ? first.errors : []),
        ...(Array.isArray(shipment.errors) ? shipment.errors : []),
    ];

    return {
        status: normalizeString(shipment.latest_tracking_status || shipment.tracking_status || shipment.status || first.latest_tracking_status || first.status || response?.status),
        latestTrackingStatus: normalizeString(shipment.latest_tracking_status || shipment.tracking_status || first.latest_tracking_status || ""),
        latestShipmentStatusCode: shipment.latest_shipment_status_code ?? shipment.shipment_status_code ?? first.latest_shipment_status_code ?? first.shipment_status_code ?? null,
        remarks: errors.length ? errors.map((item) => item.message || item.error || JSON.stringify(item)).join("; ") : normalizeString(shipment.message || first.message || first.remarks),
        orderNumber: normalizeString(orderDetails.order_number || orderDetails.orderNo || first.order_number || first.order_no),
        shipmentNumber: normalizeString(shipment.shipment_number || shipment.shipmentNumber),
        parcelNumber: normalizeString(shipment.shipment_number || shipment.parcel_number || shipment.parcelno),
        awb: normalizeString(shipment.awb_number || shipment.awb || shipment.tracking_no),
        awbLink: normalizeString(shipment.awb_url || awbUrls.A4 || awbUrls.a4 || awbUrls.A6 || awbUrls.a6 || shipment.label_url),
        trackingUrl: normalizeString(shipment.tracking_url || shipment.trackingUrl),
        price: moneyNumber(pricing.total_paid_amount || pricing.shipment_price || shipment.price || shipment.total_amount),
        courier: normalizeString(shipment.courier?.courier_name || shipment.courier_name || shipment.courier || shipment.service_name),
        raw: first,
    };
};


const manualWaybillFilename = (orderNumber) => `${orderNumber || "easyparcel-waybill"}.pdf`;

const saveWaybillPdfFromUrl = async ({ url, orderNumber }) => {
    const rawUrl = normalizeString(url);
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return { url: rawUrl, filename: manualWaybillFilename(orderNumber), stored: false };

    const filename = manualWaybillFilename(orderNumber).replace(/[^A-Za-z0-9_.-]/g, "_");
    const uploadRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
    const dir = path.join(uploadRoot, "manual-waybills");
    const target = path.join(dir, filename);

    try {
        fs.mkdirSync(dir, { recursive: true });
        const response = await axios.get(rawUrl, {
            responseType: "arraybuffer",
            timeout: EASY_PARCEL_TIMEOUT_MS,
            headers: { Accept: "application/pdf,*/*" },
        });
        const buffer = Buffer.from(response.data);
        if (buffer.length > 0) {
            fs.writeFileSync(target, buffer);
            return { url: `/uploads/manual-waybills/${filename}`, filename, stored: true, sourceUrl: rawUrl };
        }
    } catch (err) {
        console.warn("EasyParcel waybill PDF could not be stored locally", err.message);
    }

    return { url: rawUrl, filename, stored: false, sourceUrl: rawUrl };
};

const saveManualPaymentCertificate = async ({ certificate, orderNumber }) => {
    if (!certificate) return { url: "", filename: "", stored: false };
    if (typeof certificate === "string" && /^https?:\/\//i.test(certificate)) {
        return { url: certificate, filename: path.basename(certificate), stored: false };
    }
    if (typeof certificate === "string" && certificate.startsWith("/uploads/")) {
        return { url: certificate, filename: path.basename(certificate), stored: false };
    }

    const dataUrl = typeof certificate === "string" ? certificate : certificate.dataUrl || certificate.base64 || "";
    if (!dataUrl) return { url: "", filename: "", stored: false };

    const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = normalizeString(certificate.mimeType || certificate.type || (match ? match[1] : "application/octet-stream"));
    const base64Body = match ? match[2] : String(dataUrl);
    let buffer;
    try {
        buffer = Buffer.from(base64Body, "base64");
    } catch (err) {
        console.warn("Manual order payment certificate could not be decoded", err.message);
        return { url: "", filename: "", stored: false };
    }
    if (!buffer.length) return { url: "", filename: "", stored: false };

    const extensionFromMime = mimeType.includes("pdf") ? "pdf" : mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : mimeType.includes("gif") ? "gif" : "jpg";
    const originalName = normalizeString(certificate.name || certificate.filename || "");
    const extension = (originalName.split(".").pop() || extensionFromMime).replace(/[^A-Za-z0-9]/g, "") || extensionFromMime;
    const filename = `${orderNumber || "manual-order"}-payment-certificate.${extension}`.replace(/[^A-Za-z0-9_.-]/g, "_");
    const uploadRoot = path.resolve(process.env.UPLOAD_PATH || "./uploads");
    const dir = path.join(uploadRoot, "manual-payment-certificates");
    const target = path.join(dir, filename);

    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, buffer);
        return { url: `/uploads/manual-payment-certificates/${filename}`, filename, stored: true };
    } catch (err) {
        console.warn("Manual order payment certificate could not be stored", err.message);
        return { url: "", filename, stored: false };
    }
};

const buildManualOrderLogisticRaw = ({ existing = {}, selectedRate = null, easyParcel = {}, afterShip = undefined, sender = {}, receiver = {}, payment = {}, packageData = {}, content = "Product" } = {}) => ({
    ...(existing && typeof existing === "object" ? existing : {}),
    selectedRate: selectedRate || existing?.selectedRate || null,
    sender: sender || existing?.sender || {},
    receiver: receiver || existing?.receiver || {},
    payment: payment || existing?.payment || {},
    package: packageData || existing?.package || {},
    content: content || existing?.content || "Product",
    easyParcel: easyParcel !== undefined ? easyParcel : existing?.easyParcel || null,
    ...(afterShip !== undefined ? { afterShip } : {}),
});

const getOrderLogisticRaw = (order) => {
    const raw = order?.logistic_raw || order?.logisticRaw || {};
    return raw && typeof raw === "object" ? raw : {};
};

const createManualStatusHistory = async ({ user, order, oldStatus, newStatus, rawProviderStatus = "", note = "", transaction = null }) => {
    try {
        const { ManualOrderStatusHistory } = require("../../models");
        if (!ManualOrderStatusHistory || !order?.id) return null;
        return ManualOrderStatusHistory.create({
            company_id: order.company_id || user?.companyId,
            manual_order_id: order.id,
            old_status: oldStatus || null,
            new_status: newStatus,
            raw_provider_status: rawProviderStatus || null,
            note,
            created_by: user?.userId || user?.id || null,
        }, { transaction: transaction || undefined });
    } catch (err) {
        console.warn("Manual order status history could not be saved", err.message);
        return null;
    }
};

const updateManualOrderLogisticsStatus = async ({ user, order, nextStatus, rawProviderStatus = "", note = "", updates = {} }) => {
    const { ManualOrder } = require("../../models");
    const normalized = normalizeManualStatus(nextStatus, order?.status || MANUAL_ORDER_STATUSES.CREATED);
    const oldStatus = normalizeManualStatus(order?.status, MANUAL_ORDER_STATUSES.CREATED);
    const patch = {
        ...updates,
        status: normalized,
        shipment_status: normalized,
        raw_provider_status: rawProviderStatus || order?.raw_provider_status || null,
        last_status_checked_at: new Date(),
    };
    await ManualOrder.update(patch, { where: { id: order.id, company_id: user.companyId } });
    if (oldStatus !== normalized || note) {
        await createManualStatusHistory({ user, order, oldStatus, newStatus: normalized, rawProviderStatus, note });
    }
    return normalized;
};

const findManualOrderForUser = async (user, id, { includeHistory = false } = {}) => {
    const { ManualOrder, ManualOrderItem, ManualOrderStatusHistory, MerchantSku, Warehouse } = require("../../models");
    const companyId = resolveCompanyId(user);
    const normalizedId = String(id || "").replace(/^manual:/, "");
    const where = Number.isInteger(Number(normalizedId))
        ? { id: Number(normalizedId), company_id: companyId }
        : { order_number: normalizedId, company_id: companyId };

    const include = [
        { model: Warehouse, as: "warehouse", attributes: ["id", "name", "code", "location", "city", "country", "manager_name", "phone"], required: false },
        {
            model: ManualOrderItem,
            as: "items",
            include: [{ model: MerchantSku, as: "merchantSku", attributes: ["id", "sku_name", "sku_title", "image_url"], required: false }],
            required: false,
        },
    ];
    if (includeHistory && ManualOrderStatusHistory) {
        include.push({ model: ManualOrderStatusHistory, as: "statusHistory", required: false, separate: true, order: [["created_at", "ASC"]] });
    }

    const order = await ManualOrder.findOne({ where, include });
    if (!order) {
        const err = new Error("Manual order not found");
        err.statusCode = 404;
        throw err;
    }
    return order;
};

const buildStoredManualOrderBody = (order) => {
    const raw = getOrderLogisticRaw(order);
    const sender = raw.sender || {
        senderName: order.sender_name,
        company: order.sender_company,
        phone: order.sender_phone,
        email: order.sender_email,
        address: order.sender_address,
        country: order.sender_country,
        state: order.sender_state,
        city: order.sender_city,
        postcode: order.sender_postcode,
        unit: order.sender_unit,
    };
    const receiver = raw.receiver || {
        buyerName: order.buyer_name,
        name: order.buyer_name,
        phone: order.buyer_phone,
        email: order.receiver_email,
        address: order.buyer_address,
        country: order.buyer_country,
        state: order.buyer_state,
        city: order.buyer_city,
        area: order.buyer_area,
        zipCode: order.buyer_zip_code,
        unit: order.buyer_unit,
    };
    const selectedRate = raw.selectedRate || {};
    const payment = raw.payment || {
        paymentType: order.payment_type,
        orderIncome: order.order_income,
        subtotal: order.subtotal,
        discounts: order.discounts,
        shippingFee: order.shipping_fee,
        orderValue: order.order_value,
        codAmount: order.cod_amount,
        paymentCertificate: {
            url: order.payment_certificate_url,
            filename: order.payment_certificate_filename,
        },
    };
    const packageData = raw.package || {
        weight: order.package_weight,
        length: order.package_length,
        width: order.package_width,
        height: order.package_height,
    };

    return {
        type: order.type,
        warehouseId: order.warehouse_id,
        orderNumber: order.order_number,
        logisticServiceId: order.logistic_service_id || selectedRate.serviceId || selectedRate.service_id,
        logisticCompany: order.logistic_company || selectedRate.company,
        logisticRaw: selectedRate,
        currency: order.currency,
        buyer: receiver,
        sender,
        package: packageData,
        payment,
        easyParcel: {
            ...(raw.easyParcel || {}),
            bookNow: true,
            sender,
            receiverEmail: receiver.email || order.receiver_email,
            selectedRate,
            collectDate: raw.easyParcel?.collectDate || todayDate(),
            content: order.package_content || raw.content || "Product",
            parcelValue: Math.max(1, moneyNumber(order.cod_amount || order.order_value || order.subtotal || 1)),
        },
        afterShip: {
            ...(raw.afterShip || raw.aftership || {}),
            submitNow: true,
            bookNow: true,
            sender,
            receiverEmail: receiver.email || order.receiver_email,
            selectedRate,
            content: order.package_content || raw.content || "Product",
            parcelValue: Math.max(1, moneyNumber(order.cod_amount || order.order_value || order.subtotal || 1)),
        },
        items: (order.items || []).map((item) => ({
            merchantSkuId: item.merchant_sku_id,
            sku: item.sku,
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            weight: item.weight,
            image: item.image_url,
        })),
    };
};

const trackingResultMatchesOrder = (item, order) => {
    if (!item || !order) return false;
    const candidates = [
        order.awb_number,
        order.tracking_number,
        order.provider_shipment_number,
        order.provider_order_number,
        order.parcel_number,
    ].map(normalizeString).filter(Boolean);
    const fields = [
        item.awb_number,
        item.awbNumber,
        item.tracking_number,
        item.trackingNumber,
        item.shipment_number,
        item.shipmentNumber,
        item.order_number,
        item.orderNumber,
        item.parcel_number,
        item.parcelNumber,
    ].map(normalizeString).filter(Boolean);
    return fields.some((field) => candidates.includes(field));
};

const pickTrackingObject = (payload, order = null) => {
    if (!payload) return {};
    if (Array.isArray(payload)) {
        const matched = order ? payload.find((item) => trackingResultMatchesOrder(item, order)) : null;
        return pickTrackingObject(matched || payload[0], order);
    }
    if (payload.data?.results) return pickTrackingObject(payload.data.results, order);
    if (payload.results) return pickTrackingObject(payload.results, order);
    if (payload.data && Array.isArray(payload.data)) return pickTrackingObject(payload.data, order);
    const data = payload.data || payload.result || payload.parcel || payload.shipment || payload.shipments || payload.tracking || payload;
    if (Array.isArray(data)) return pickTrackingObject(data, order);
    return data && typeof data === "object" ? data : {};
};

const getLatestTrackingLog = (item) => {
    const logs = Array.isArray(item?.status_log) ? item.status_log : Array.isArray(item?.statusLog) ? item.statusLog : [];
    return logs.length ? logs[logs.length - 1] : {};
};

const getProviderTrackingResultStatus = (item) => normalizeString(item?.status).toLowerCase();

const assertSuccessfulTrackingResult = (item) => {
    const resultStatus = getProviderTrackingResultStatus(item);
    if (!resultStatus || resultStatus === "success") return;
    if (!["not_found", "error", "failed", "failure"].includes(resultStatus) && normalizeEasyParcelTrackingStatus(resultStatus, item?.status_code ?? item?.statusCode)) return;
    const message = normalizeString(item.message || item.error || item.remarks || "EasyParcel tracking result was not successful.");
    const err = new Error(message);
    err.statusCode = resultStatus === "not_found" ? 404 : 502;
    throw err;
};

const extractProviderTrackingStatus = (payload, order = null) => {
    const item = pickTrackingObject(payload, order);
    const latestLog = getLatestTrackingLog(item);
    const resultStatus = getProviderTrackingResultStatus(item);
    const requestStatus = ["success", "not_found", "error"].includes(resultStatus) ? "" : item.status;
    return normalizeString(
        item.latest_tracking_status ||
        item.latestTrackingStatus ||
        latestLog.tracking_status ||
        latestLog.trackingStatus ||
        item.tracking_status ||
        item.trackingStatus ||
        item.parcel_status ||
        item.parcelStatus ||
        item.shipment_status ||
        item.order_status ||
        item.latest_status ||
        item.latestStatus ||
        requestStatus ||
        item.message
    );
};

const extractProviderTrackingStatusCode = (payload, order = null) => {
    const item = pickTrackingObject(payload, order);
    const latestLog = getLatestTrackingLog(item);
    return item.latest_shipment_status_code ??
        item.latestShipmentStatusCode ??
        latestLog.shipment_status_code ??
        latestLog.shipmentStatusCode ??
        item.shipment_status_code ??
        item.shipmentStatusCode ??
        item.status_code ??
        item.statusCode ??
        null;
};

const stripEasyParcelRefreshError = (raw = {}) => {
    const cleaned = raw && typeof raw === "object" ? { ...raw } : {};
    if (cleaned.easyParcel && typeof cleaned.easyParcel === "object") {
        const { error, errorResponse, ...easyParcel } = cleaned.easyParcel;
        cleaned.easyParcel = easyParcel;
    }
    return cleaned;
};

const fetchEasyParcelLatestStatus = async ({ config, order }) => {
    const awb = normalizeString(order.awb_number || order.tracking_number);
    const orderNumber = normalizeString(order.provider_order_number || order.order_number);
    const parcelNumber = normalizeString(order.parcel_number);
    const shipmentNumber = normalizeString(order.provider_shipment_number);
    const trackingNumber = awb || parcelNumber || shipmentNumber || orderNumber;
    const data = awb
        ? { awb_numbers: [awb] }
        : {
            shipment: [{
                awb_number: awb,
                order_number: orderNumber,
                parcel_number: parcelNumber,
                shipment_number: shipmentNumber,
                tracking_number: trackingNumber,
            }],
            awb_number: awb,
            order_number: orderNumber,
            parcel_number: parcelNumber,
            shipment_number: shipmentNumber,
            tracking_number: trackingNumber,
        };
    const defaultPath = `/open_api/${config.openApiVersion}/shipment/tracking_status`;
    const fallbackPaths = [
        `/open_api/${config.openApiVersion}/shipment/tracking`,
        `/open_api/${config.openApiVersion}/shipment/trackings`,
        `/open_api/${config.openApiVersion}/shipment/status`,
        `/open_api/${config.openApiVersion}/shipment/parcel_status`,
    ].filter((candidate) => candidate !== (config.trackingPath || defaultPath));
    const response = await callEasyParcelOpenApi(config, {
        method: "POST",
        path: config.trackingPath || defaultPath,
            fallbackPaths,
            data,
        });
    const item = pickTrackingObject(response, order);
    assertSuccessfulTrackingResult(item);
    const rawStatus = extractProviderTrackingStatus(response, order);
    const rawStatusCode = extractProviderTrackingStatusCode(response, order);
    const latestLog = getLatestTrackingLog(item);
    const latestLogStatus = normalizeString(latestLog.tracking_status || latestLog.trackingStatus);
    const latestLogStatusCode = latestLog.shipment_status_code ?? latestLog.shipmentStatusCode ?? null;
    const normalizedStatus = normalizeEasyParcelTrackingStatus(rawStatus, rawStatusCode);
    const normalizedLogStatus = normalizeEasyParcelTrackingStatus(latestLogStatus, latestLogStatusCode);
    const finalLogStatus = FINAL_SHIPMENT_STATUSES.has(normalizedLogStatus) ? normalizedLogStatus : "";
    return {
        response,
        rawStatus: finalLogStatus ? latestLogStatus : rawStatus,
        rawStatusCode: finalLogStatus ? latestLogStatusCode : rawStatusCode,
        normalizedStatus: finalLogStatus || normalizedStatus || order.status,
    };
};

const getTrackingRows = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data?.results)) return payload.data.results;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
};

const fetchEasyParcelTrackingStatusMap = async ({ config, awbNumbers = [] }) => {
    const uniqueAwbs = [...new Set(awbNumbers.map(normalizeString).filter(Boolean))];
    if (!uniqueAwbs.length) return new Map();

    const response = await callEasyParcelOpenApi(config, {
        method: "POST",
        path: `/open_api/${config.openApiVersion}/shipment/tracking_status`,
        data: { awb_numbers: uniqueAwbs },
    });

    const map = new Map();
    getTrackingRows(response).forEach((item) => {
        const awb = normalizeString(item.awb_number || item.awbNumber);
        if (!awb) return;
        const resultStatus = getProviderTrackingResultStatus(item);
        if (resultStatus && resultStatus !== "success") {
            map.set(awb, {
                ok: false,
                error: normalizeString(item.message || item.error || item.remarks || resultStatus),
                raw: item,
            });
            return;
        }
        const latestLog = getLatestTrackingLog(item);
        const rawStatus = normalizeString(
            item.latest_tracking_status ||
            item.latestTrackingStatus ||
            latestLog.tracking_status ||
            latestLog.trackingStatus ||
            item.tracking_status ||
            item.trackingStatus ||
            item.shipment_status
        );
        const rawStatusCode = item.latest_shipment_status_code ??
            item.latestShipmentStatusCode ??
            latestLog.shipment_status_code ??
            latestLog.shipmentStatusCode ??
            item.shipment_status_code ??
            item.shipmentStatusCode ??
            null;
        map.set(awb, {
            ok: true,
            rawStatus,
            rawStatusCode,
            normalizedStatus: normalizeEasyParcelTrackingStatus(rawStatus, rawStatusCode),
            raw: item,
        });
    });
    return map;
};

const inferCodStatusFromShipment = (paymentType, shipmentStatus, currentStatus = COD_STATUSES.NOT_APPLICABLE) => {
    if (normalizePaymentType(paymentType) !== "COD") return COD_STATUSES.NOT_APPLICABLE;
    const normalized = normalizeManualStatus(shipmentStatus);
    if (normalized === MANUAL_ORDER_STATUSES.DELIVERED) return COD_STATUSES.DELIVERED_PENDING_SETTLEMENT;
    if (normalized === MANUAL_ORDER_STATUSES.RETURNED || normalized === MANUAL_ORDER_STATUSES.CANCELLED) return COD_STATUSES.FAILED_OR_RETURNED;
    if ([MANUAL_ORDER_STATUSES.COLLECTED, MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT, MANUAL_ORDER_STATUSES.DELIVERY_ON_HOLD].includes(normalized)) {
        return COD_STATUSES.COLLECTED_BY_COURIER;
    }
    return currentStatus || COD_STATUSES.PENDING_COLLECTION;
};

const overlayManualOrderWithLiveTracking = (apiOrder, tracking) => {
    if (!apiOrder || !tracking?.ok || !tracking.normalizedStatus) return apiOrder;
    const statusCode = tracking.normalizedStatus;
    return {
        ...apiOrder,
        status: statusLabel(statusCode),
        statusCode,
        rawStatus: statusCode,
        shipmentStatus: statusCode,
        shipmentStatusLabel: statusLabel(statusCode),
        rawProviderStatus: tracking.rawStatus || apiOrder.rawProviderStatus,
        bookingError: "",
        codStatus: inferCodStatusFromShipment(apiOrder.paymentType, statusCode, apiOrder.codStatus),
        liveEasyParcel: {
            source: "tracking_status",
            rawStatus: tracking.rawStatus,
            rawStatusCode: tracking.rawStatusCode,
            raw: tracking.raw,
        },
    };
};

const overlayManualOrderWithAfterShipTracking = (apiOrder, tracking) => {
    if (!apiOrder || !tracking?.ok || !tracking.normalizedStatus) return apiOrder;
    const statusCode = tracking.normalizedStatus;
    return {
        ...apiOrder,
        status: statusLabel(statusCode),
        statusCode,
        rawStatus: statusCode,
        shipmentStatus: statusCode,
        shipmentStatusLabel: statusLabel(statusCode),
        rawProviderStatus: tracking.rawStatus || apiOrder.rawProviderStatus,
        bookingError: "",
        codStatus: inferCodStatusFromShipment(apiOrder.paymentType, statusCode, apiOrder.codStatus),
        afterShip: apiOrder.afterShip ? {
            ...apiOrder.afterShip,
            trackingId: tracking.trackingId || apiOrder.afterShip.trackingId,
            trackingNumber: tracking.trackingNumber || apiOrder.afterShip.trackingNumber,
            courierSlug: tracking.slug || apiOrder.afterShip.courierSlug,
        } : apiOrder.afterShip,
        liveAfterShip: {
            source: "tracking",
            rawStatus: tracking.rawStatus,
            trackingId: tracking.trackingId,
            trackingNumber: tracking.trackingNumber,
            slug: tracking.slug,
            raw: tracking.raw,
        },
    };
};

const normalizeEasyParcelShipmentDetails = (response, shipmentNumber) => {
    const rows = Array.isArray(response?.data) ? response.data : response?.data ? [response.data] : [];
    return rows.find((item) => normalizeString(item.shipment_number) === shipmentNumber) || rows[0] || null;
};

const getShipmentDetailsStatus = (shipment = {}) => {
    const details = shipment.shipment_details || shipment.shipmentDetails || {};
    return {
        rawStatus: normalizeString(details.shipment_status || shipment.shipment_status || shipment.status),
        rawStatusCode: details.shipment_status_code ?? shipment.shipment_status_code ?? null,
        awbNumber: normalizeString(details.awb_number || shipment.awb_number || shipment.awb),
        awbUrl: normalizeString(details.awb_url || shipment.awb_url),
        trackingUrl: normalizeString(details.tracking_url || shipment.tracking_url),
        shipmentNumber: normalizeString(shipment.shipment_number),
        providerOrderNumber: normalizeString(shipment.order_number),
    };
};

const overlayManualOrderWithShipmentDetails = (apiOrder, shipment) => {
    if (!apiOrder || !shipment) return apiOrder;
    const details = getShipmentDetailsStatus(shipment);
    const normalizedStatus = normalizeEasyParcelTrackingStatus(details.rawStatus, details.rawStatusCode) || apiOrder.statusCode;
    return {
        ...apiOrder,
        status: statusLabel(normalizedStatus),
        statusCode: normalizedStatus,
        rawStatus: normalizedStatus,
        shipmentStatus: normalizedStatus,
        shipmentStatusLabel: statusLabel(normalizedStatus),
        rawProviderStatus: details.rawStatus || apiOrder.rawProviderStatus,
        awbNumber: details.awbNumber || apiOrder.awbNumber,
        trackingNo: details.awbNumber || apiOrder.trackingNo,
        providerOrderNumber: details.providerOrderNumber || apiOrder.providerOrderNumber,
        providerShipmentNumber: details.shipmentNumber || apiOrder.providerShipmentNumber,
        waybillPdfUrl: details.awbUrl || apiOrder.waybillPdfUrl,
        trackingUrl: details.trackingUrl || apiOrder.trackingUrl,
        codStatus: inferCodStatusFromShipment(apiOrder.paymentType, normalizedStatus, apiOrder.codStatus),
        liveEasyParcel: {
            source: "shipment_details",
            shipment,
        },
    };
};

const getEasyParcelShipmentDetails = async (user, body = {}) => {
    resolveCompanyId(user);
    const shipmentNumber = normalizeString(
        body.shipmentNumber ||
        body.shipment_number ||
        body.easyParcelShipmentNumber ||
        body.easyparcel_shipment_number ||
        body.orderId ||
        body.order_id
    );
    const country = normalizeCountryCode(body.country || body.easyparcelCountry || body.easyparcel_country || "MY", "MY");
    const config = getEasyParcelConfig(country);

    if (!shipmentNumber) {
        const err = new Error("EasyParcel shipmentNumber is required. The EasyParcel details API expects shipment_number, for example ES-2601-K8S32.");
        err.statusCode = 400;
        throw err;
    }
    if (!/^ES-/i.test(shipmentNumber)) {
        const err = new Error("EasyParcel shipment details requires shipment_number format like ES-2601-K8S32. Use the EasyParcel shipment number, not the ERP manual order ID.");
        err.statusCode = 400;
        throw err;
    }

    const response = await callEasyParcelOpenApi(config, {
        method: "POST",
        path: `/open_api/${config.openApiVersion}/shipment/details`,
        data: { shipment_number: shipmentNumber },
    });
    const shipment = normalizeEasyParcelShipmentDetails(response, shipmentNumber);

    if (!shipment) {
        const err = new Error("EasyParcel shipment details not found.");
        err.statusCode = 404;
        err.easyParcelResponse = response;
        throw err;
    }
    if (normalizeString(shipment.status).toLowerCase() === "error") {
        const err = new Error(shipment.message || response?.message || "EasyParcel shipment details request failed.");
        err.statusCode = 502;
        err.easyParcelResponse = response;
        throw err;
    }

    return {
        message: "EasyParcel shipment details fetched",
        country: config.country,
        shipmentNumber,
        shipment,
        easyParcelResponse: response,
    };
};

const parseEasyParcelCancelResult = (response, shipmentNumber) => {
    const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response?.data?.results) ? response.data.results : [];
    const matched = rows.find((row) => normalizeString(row.shipment_number) === normalizeString(shipmentNumber)) || rows[0] || {};
    const status = normalizeString(matched.status || response?.status);
    const message = normalizeString(matched.message || response?.message || "");
    return {
        ok: status.toLowerCase() === "success" || /cancelled/i.test(message),
        status,
        message,
        shipmentNumber: normalizeString(matched.shipment_number || shipmentNumber),
        raw: response,
    };
};

const cancelEasyParcelShipment = async ({ config, shipmentNumber, remark = "Cancelled from ERP manual order" }) => {
    if (!shipmentNumber) {
        const err = new Error("EasyParcel shipment number is required for cancellation.");
        err.statusCode = 400;
        throw err;
    }
    const response = await callEasyParcelOpenApi(config, {
        method: "POST",
        path: `/open_api/${config.openApiVersion}/shipment/cancel`,
        data: {
            cancel_list: [{ shipment_number: shipmentNumber, remark }],
        },
    });
    const parsed = parseEasyParcelCancelResult(response, shipmentNumber);
    if (!parsed.ok) {
        const err = new Error(parsed.message || "EasyParcel cancellation failed.");
        err.statusCode = 400;
        err.easyParcelResponse = response;
        throw err;
    }
    return parsed;
};

const bookEasyParcelShipment = async ({ user, warehouse, body, createdOrder, type }) => {
    const { ManualOrder } = require("../../models");
    const easyParcel = body.easyParcel || {};
    const sender = getWarehouseSender(warehouse, easyParcel.sender || body.sender || {});
    const receiver = getBuyerReceiver({ ...(body.buyer || {}), email: easyParcel.receiverEmail || body?.buyer?.email }, sender.country);
    const config = getEasyParcelConfig(sender.country);
    const selectedRate = easyParcel.selectedRate || body.logisticRaw || body.logistic_raw || {};
    const serviceId = normalizeString(body.logisticServiceId || body.logistic_service_id || selectedRate.serviceId || selectedRate.service_id);
    const isCancelledRebook = normalizeManualStatus(createdOrder?.status) === MANUAL_ORDER_STATUSES.CANCELLED;

    if (!easyParcel.bookNow) return null;
    if (!serviceId) {
        const err = new Error("Select an EasyParcel courier service before booking shipment.");
        err.statusCode = 400;
        throw err;
    }

    const existingRaw = getOrderLogisticRaw(createdOrder);
    const bookingResult = {
        originCountry: config.country,
        currency: config.currency,
        mode: config.mode,
        serviceId,
        selectedRate,
        submitted: false,
        paid: false,
        submitNow: true,
        openApi: true,
    };

    await updateManualOrderLogisticsStatus({
        user,
        order: createdOrder,
        nextStatus: MANUAL_ORDER_STATUSES.BOOKING_PENDING,
        note: "EasyParcel booking started",
        updates: { booking_status: "BOOKING_PENDING", booking_error: null },
    });

    try {
        const submitPayload = buildSubmitOrderPayload({ config, warehouse, body, orderNumber: createdOrder.order_number, type });
        const submitResponse = await callEasyParcelOpenApi(config, {
            method: "POST",
            path: config.submitPath,
            fallbackPaths: [`/open_api/${config.openApiVersion}/shipment/submit_orders`],
            data: submitPayload,
        });
        const submit = parseSubmitResult(submitResponse);
        if (!submit.orderNumber && !submit.shipmentNumber && !submit.awb && !submit.awbLink) {
            const err = new Error(submit.remarks || "EasyParcel shipment was not created.");
            err.easyParcelResponse = submitResponse;
            throw err;
        }

        Object.assign(bookingResult, {
            submitted: true,
            paid: Boolean(submit.awb || submit.awbLink || submit.price > 0),
            orderNumber: submit.orderNumber,
            shipmentNumber: submit.shipmentNumber,
            parcelNumber: submit.parcelNumber,
            awb: submit.awb,
            awbLink: submit.awbLink,
            trackingUrl: submit.trackingUrl,
            price: submit.price || selectedRate.price || 0,
            courier: submit.courier || selectedRate.company || selectedRate.serviceName || "EasyParcel",
            submitResponse,
        });

        const savedWaybill = await saveWaybillPdfFromUrl({ url: bookingResult.awbLink, orderNumber: createdOrder.order_number });
        if (savedWaybill.url) {
            bookingResult.awbLink = savedWaybill.url;
            bookingResult.pdfFilename = savedWaybill.filename;
            bookingResult.sourceAwbLink = savedWaybill.sourceUrl || bookingResult.awbLink;
            bookingResult.waybillStoredLocally = savedWaybill.stored;
        }

        const nextStatus = inferEasyParcelStatusFromSubmit(submit);
        const paymentType = normalizeManualOrderPaymentType(body.payment || {});
        const codAmount = paymentType === "COD"
            ? Math.max(1, moneyNumber(body.payment?.codAmount || easyParcel.parcelValue || body.payment?.orderValue || body.payment?.subtotal || 0))
            : 0;
        const packageData = resolvePackageDimensions(body);
        const logisticRaw = buildManualOrderLogisticRaw({
            existing: existingRaw,
            selectedRate,
            sender,
            receiver,
            payment: body.payment || {},
            packageData,
            content: easyParcel.content || createdOrder.package_content || "Product",
            easyParcel: bookingResult,
        });

        const updatePatch = {
            booking_status: "BOOKED",
            status: nextStatus,
            shipment_status: nextStatus,
            cod_status: paymentType === "COD" ? COD_STATUSES.PENDING_COLLECTION : COD_STATUSES.NOT_APPLICABLE,
            logistic_service_id: serviceId,
            logistic_company: bookingResult.courier || selectedRate.company || createdOrder.logistic_company,
            logistic_raw: logisticRaw,
            tracking_number: bookingResult.awb || bookingResult.shipmentNumber || bookingResult.parcelNumber || (isCancelledRebook ? null : createdOrder.tracking_number),
            awb_number: bookingResult.awb || (isCancelledRebook ? null : createdOrder.awb_number),
            provider_order_number: bookingResult.orderNumber || (isCancelledRebook ? null : createdOrder.provider_order_number),
            provider_shipment_number: bookingResult.shipmentNumber || (isCancelledRebook ? null : createdOrder.provider_shipment_number),
            parcel_number: bookingResult.parcelNumber || (isCancelledRebook ? null : createdOrder.parcel_number),
            waybill_pdf_url: bookingResult.awbLink || (isCancelledRebook ? null : createdOrder.waybill_pdf_url),
            waybill_pdf_filename: bookingResult.pdfFilename || (isCancelledRebook ? null : manualWaybillFilename(createdOrder.order_number)),
            tracking_url: bookingResult.trackingUrl || (isCancelledRebook ? null : createdOrder.tracking_url),
            raw_provider_status: submit.status || nextStatus,
            easyparcel_country: config.country,
            shipping_fee: bookingResult.price || selectedRate.price || createdOrder.shipping_fee,
            cod_amount: codAmount,
            booking_error: null,
            last_status_checked_at: new Date(),
        };

        await ManualOrder.update(updatePatch, { where: { id: createdOrder.id, company_id: user.companyId } });
        await createManualStatusHistory({
            user,
            order: createdOrder,
            oldStatus: createdOrder.status,
            newStatus: nextStatus,
            rawProviderStatus: submit.status || nextStatus,
            note: "EasyParcel booking completed and waybill stored",
        });

        return bookingResult;
    } catch (err) {
        const logisticRaw = buildManualOrderLogisticRaw({
            existing: existingRaw,
            selectedRate,
            sender,
            receiver,
            payment: body.payment || {},
            packageData: resolvePackageDimensions(body),
            content: easyParcel.content || createdOrder.package_content || "Product",
            easyParcel: {
                ...bookingResult,
                error: err.message || "EasyParcel booking failed",
                errorResponse: err.easyParcelResponse || null,
            },
        });
        await ManualOrder.update({
            status: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
            shipment_status: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
            booking_status: "BOOKING_FAILED",
            booking_error: err.message || "EasyParcel booking failed",
            logistic_raw: logisticRaw,
            last_status_checked_at: new Date(),
            ...(isCancelledRebook ? {
                tracking_number: null,
                awb_number: null,
                provider_order_number: null,
                provider_shipment_number: null,
                parcel_number: null,
                waybill_pdf_url: null,
                waybill_pdf_filename: null,
                tracking_url: null,
            } : {}),
        }, { where: { id: createdOrder.id, company_id: user.companyId } });
        await createManualStatusHistory({
            user,
            order: createdOrder,
            oldStatus: createdOrder.status,
            newStatus: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
            rawProviderStatus: "BOOKING_FAILED",
            note: err.message || "EasyParcel booking failed",
        });
        const wrapped = new Error(`Manual order saved, but EasyParcel booking failed: ${err.message}`);
        wrapped.statusCode = err.statusCode || 502;
        wrapped.manualOrderSaved = true;
        throw wrapped;
    }
};

const normalizeAfterShipTrackingStatus = (rawStatus) => {
    const raw = normalizeString(rawStatus).toLowerCase().replace(/[\s-]+/g, "_");
    if (!raw) return "";
    if (raw.includes("delivered")) return MANUAL_ORDER_STATUSES.DELIVERED;
    if (raw.includes("return")) return MANUAL_ORDER_STATUSES.RETURNED;
    if (raw.includes("exception") || raw.includes("failed") || raw.includes("attemptfail") || raw.includes("attempt_fail")) return MANUAL_ORDER_STATUSES.DELIVERY_ON_HOLD;
    if (raw.includes("outfordelivery") || raw.includes("out_for_delivery") || raw.includes("transit")) return MANUAL_ORDER_STATUSES.DELIVERY_IN_TRANSIT;
    if (raw.includes("pickup") || raw.includes("available_for_pickup")) return MANUAL_ORDER_STATUSES.TO_BE_COLLECTED;
    if (raw.includes("info_received") || raw.includes("inforeceived") || raw.includes("pending")) return MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT;
    if (raw.includes("cancel")) return MANUAL_ORDER_STATUSES.CANCELLED;
    return "";
};

const inferAfterShipStatusFromLabel = (label = {}) => {
    const normalized = normalizeAfterShipTrackingStatus(label.status || label.raw?.status || label.raw?.tag);
    if (normalized) return normalized;
    if (label.trackingNumber || label.labelUrl || label.labelId) return MANUAL_ORDER_STATUSES.SCHEDULE_IN_ARRANGEMENT;
    return MANUAL_ORDER_STATUSES.CREATED;
};

const buildAfterShipLabelPayload = ({ config, warehouse = {}, body = {}, orderNumber, type }) => {
    const afterShip = body.afterShip || {};
    const sender = getWarehouseSender(warehouse, afterShip.sender || body.sender || {});
    const receiver = getBuyerReceiver({ ...(body.buyer || {}), email: afterShip.receiverEmail || body?.buyer?.email }, sender.country);
    const selectedRate = afterShip.selectedRate || body.logisticRaw || body.logistic_raw || {};
    const shipperAccountId = normalizeString(
        body.shipperAccountId ||
        body.shipper_account_id ||
        afterShip.shipperAccountId ||
        selectedRate.shipperAccountId ||
        selectedRate.shipper_account_id ||
        config.defaultShipperAccountId
    );
    const serviceType = normalizeString(
        body.logisticServiceId ||
        body.logistic_service_id ||
        body.serviceType ||
        body.service_type ||
        afterShip.serviceType ||
        selectedRate.serviceType ||
        selectedRate.service_type ||
        selectedRate.serviceId ||
        config.defaultServiceType
    );
    const courierSlug = normalizeString(afterShip.courierSlug || selectedRate.courierSlug || selectedRate.courier_slug || config.defaultCourierSlug);
    const senderCountry = normalizeCountryCode(sender.country, config.country);
    const receiverCountry = normalizeCountryCode(receiver.country, senderCountry);
    const paymentType = normalizeManualOrderPaymentType(body.payment || {});
    const declaredValue = Math.max(1, moneyNumber(afterShip.parcelValue || body.payment?.orderValue || body.payment?.subtotal || body.orderValue || 1));

    const missing = [];
    if (!shipperAccountId) missing.push("shipper account");
    if (!serviceType) missing.push("service type");
    if (!sender.senderName) missing.push("sender name");
    if (!sender.phone) missing.push("sender phone");
    if (!sender.address) missing.push("sender address");
    if (!sender.city) missing.push("sender city");
    if (!sender.postcode) missing.push("sender postcode");
    if (!receiver.name) missing.push("receiver name");
    if (!receiver.phone) missing.push("receiver phone");
    if (!receiver.address) missing.push("receiver address");
    if (!receiver.city) missing.push("receiver city");
    if (!receiver.postcode) missing.push("receiver postcode");
    if (!AFTERSHIP_SUPPORTED_COUNTRIES[senderCountry] || !AFTERSHIP_SUPPORTED_COUNTRIES[receiverCountry]) missing.push("supported country PH/VN/TH/ID/MY/SG");
    if (senderCountry !== receiverCountry) missing.push("same sender and receiver country");
    if (missing.length) {
        const err = new Error(`Missing AfterShip booking information: ${missing.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }

    const shipment = buildAfterShipShipment({
        config,
        sender,
        receiver,
        body: {
            ...body,
            orderNumber,
            packageContent: afterShip.content || body.packageContent || body.package_content || (type === "gift" ? "Gift" : "Product"),
        },
    });

    const serviceOptions = Array.isArray(afterShip.serviceOptions) ? [...afterShip.serviceOptions] : [];
    if (paymentType === "COD") {
        serviceOptions.push({
            type: "cod",
            cod: {
                amount: declaredValue,
                currency: config.currency,
            },
        });
    }

    return {
        shipper_account: { id: shipperAccountId },
        service_type: serviceType,
        ...(courierSlug ? { courier: { slug: courierSlug } } : {}),
        shipment,
        file_type: normalizeString(afterShip.fileType || body.fileType || "pdf").toLowerCase() === "zpl" ? "zpl" : "pdf",
        ship_date: normalizeString(afterShip.shipDate || body.shipDate || body.ship_date || todayDate()),
        order_number: trimMax(orderNumber, 80),
        order_id: trimMax(orderNumber, 80),
        custom_fields: {
            erp_order_number: trimMax(orderNumber, 80),
            provider: "aftership",
        },
        ...(serviceOptions.length ? { service_options: serviceOptions } : {}),
    };
};

const parseAfterShipLabelResult = (response) => {
    const data = response?.data?.label || response?.data || response?.label || response || {};
    const files = data.files || {};
    const labelFile = files.label || files.labels || data.label || {};
    const labelUrl = normalizeString(
        data.label_url ||
        data.labelUrl ||
        labelFile.url ||
        labelFile.href ||
        (Array.isArray(labelFile) ? labelFile[0]?.url : "")
    );
    const trackingNumbers = Array.isArray(data.tracking_numbers) ? data.tracking_numbers
        : Array.isArray(data.trackingNumbers) ? data.trackingNumbers
            : [];
    const trackingNumber = normalizeString(
        data.tracking_number ||
        data.trackingNumber ||
        trackingNumbers[0] ||
        data.tracking?.tracking_number
    );
    const courier = data.courier || {};
    const charge = data.total_charge || data.charge || {};
    return {
        labelId: normalizeString(data.id || data.label_id || data.labelId),
        status: normalizeString(data.status || data.tag || data.state),
        trackingNumber,
        trackingUrl: normalizeString(data.tracking_url || data.trackingUrl || data.tracking?.tracking_url),
        labelUrl,
        price: moneyNumber(charge.amount || data.price || data.total_amount),
        currency: normalizeString(charge.currency || data.currency),
        courier: normalizeString(courier.name || data.courier_name || courier.slug || data.courier_slug),
        courierSlug: normalizeString(courier.slug || data.courier_slug),
        serviceType: normalizeString(data.service_type || data.serviceType),
        raw: data,
        response,
    };
};

const buildManualOrderLogisticRawWithAfterShip = ({ existing = {}, selectedRate = null, afterShip = {}, sender = {}, receiver = {}, payment = {}, packageData = {}, content = "Product" } = {}) => ({
    ...(existing && typeof existing === "object" ? existing : {}),
    selectedRate: selectedRate || existing?.selectedRate || null,
    sender: sender || existing?.sender || {},
    receiver: receiver || existing?.receiver || {},
    payment: payment || existing?.payment || {},
    package: packageData || existing?.package || {},
    content: content || existing?.content || "Product",
    afterShip,
});

const bookAfterShipShipment = async ({ user, warehouse, body, createdOrder, type }) => {
    const { ManualOrder } = require("../../models");
    const afterShip = body.afterShip || {};
    const sender = getWarehouseSender(warehouse, afterShip.sender || body.sender || {});
    const receiver = getBuyerReceiver({ ...(body.buyer || {}), email: afterShip.receiverEmail || body?.buyer?.email }, sender.country);
    const config = getAfterShipConfig(sender.country);
    const selectedRate = afterShip.selectedRate || body.logisticRaw || body.logistic_raw || {};
    const serviceId = normalizeString(body.logisticServiceId || body.logistic_service_id || selectedRate.serviceType || selectedRate.service_id || selectedRate.serviceId);
    const isCancelledRebook = normalizeManualStatus(createdOrder?.status) === MANUAL_ORDER_STATUSES.CANCELLED;

    const existingRaw = getOrderLogisticRaw(createdOrder);
    const bookingResult = {
        originCountry: config.country,
        currency: config.currency,
        mode: config.mode,
        shipperAccountId: afterShip.shipperAccountId || selectedRate.shipperAccountId || config.defaultShipperAccountId,
        serviceId,
        selectedRate,
        submitted: false,
        submitNow: true,
        api: "aftership-shipping",
    };

    await updateManualOrderLogisticsStatus({
        user,
        order: createdOrder,
        nextStatus: MANUAL_ORDER_STATUSES.BOOKING_PENDING,
        note: "AfterShip booking started",
        updates: { booking_status: "BOOKING_PENDING", booking_error: null },
    });

    try {
        const labelPayload = buildAfterShipLabelPayload({ config, warehouse, body, orderNumber: createdOrder.order_number, type });
        const labelResponse = await callAfterShipApi(config, { method: "POST", path: "/labels", data: labelPayload });
        const label = parseAfterShipLabelResult(labelResponse);
        if (!label.labelId && !label.trackingNumber && !label.labelUrl) {
            const err = new Error(label.status || "AfterShip label was not created.");
            err.afterShipResponse = labelResponse;
            throw err;
        }

        Object.assign(bookingResult, {
            submitted: true,
            labelId: label.labelId,
            trackingNumber: label.trackingNumber,
            labelUrl: label.labelUrl,
            trackingUrl: label.trackingUrl,
            price: label.price || selectedRate.price || 0,
            courier: label.courier || selectedRate.company || selectedRate.serviceName || "AfterShip",
            courierSlug: label.courierSlug || selectedRate.courierSlug || config.defaultCourierSlug,
            serviceType: label.serviceType || selectedRate.serviceType || serviceId,
            labelResponse,
        });

        const savedWaybill = await saveWaybillPdfFromUrl({ url: bookingResult.labelUrl, orderNumber: createdOrder.order_number });
        if (savedWaybill.url) {
            bookingResult.labelUrl = savedWaybill.url;
            bookingResult.pdfFilename = savedWaybill.filename;
            bookingResult.sourceLabelUrl = savedWaybill.sourceUrl || bookingResult.labelUrl;
            bookingResult.waybillStoredLocally = savedWaybill.stored;
        }

        const nextStatus = inferAfterShipStatusFromLabel(label);
        const paymentType = normalizeManualOrderPaymentType(body.payment || {});
        const codAmount = paymentType === "COD"
            ? Math.max(1, moneyNumber(body.payment?.codAmount || afterShip.parcelValue || body.payment?.orderValue || body.payment?.subtotal || 0))
            : 0;
        const packageData = resolvePackageDimensions(body);
        const logisticRaw = buildManualOrderLogisticRawWithAfterShip({
            existing: existingRaw,
            selectedRate,
            sender,
            receiver,
            payment: body.payment || {},
            packageData,
            content: afterShip.content || createdOrder.package_content || "Product",
            afterShip: bookingResult,
        });

        const updatePatch = {
            booking_status: "BOOKED",
            status: nextStatus,
            shipment_status: nextStatus,
            cod_status: paymentType === "COD" ? COD_STATUSES.PENDING_COLLECTION : COD_STATUSES.NOT_APPLICABLE,
            logistic_service_id: bookingResult.serviceType || serviceId,
            logistic_company: bookingResult.courier || selectedRate.company || createdOrder.logistic_company,
            logistic_raw: logisticRaw,
            tracking_number: bookingResult.trackingNumber || (isCancelledRebook ? null : createdOrder.tracking_number),
            awb_number: bookingResult.trackingNumber || (isCancelledRebook ? null : createdOrder.awb_number),
            provider_order_number: bookingResult.labelId || (isCancelledRebook ? null : createdOrder.provider_order_number),
            provider_shipment_number: bookingResult.labelId || (isCancelledRebook ? null : createdOrder.provider_shipment_number),
            parcel_number: bookingResult.labelId || (isCancelledRebook ? null : createdOrder.parcel_number),
            waybill_pdf_url: bookingResult.labelUrl || (isCancelledRebook ? null : createdOrder.waybill_pdf_url),
            waybill_pdf_filename: bookingResult.pdfFilename || (isCancelledRebook ? null : manualWaybillFilename(createdOrder.order_number)),
            tracking_url: bookingResult.trackingUrl || (isCancelledRebook ? null : createdOrder.tracking_url),
            raw_provider_status: label.status || nextStatus,
            easyparcel_country: config.country,
            shipping_fee: bookingResult.price || selectedRate.price || createdOrder.shipping_fee,
            cod_amount: codAmount,
            booking_error: null,
            last_status_checked_at: new Date(),
        };

        await ManualOrder.update(updatePatch, { where: { id: createdOrder.id, company_id: user.companyId } });
        await createManualStatusHistory({
            user,
            order: createdOrder,
            oldStatus: createdOrder.status,
            newStatus: nextStatus,
            rawProviderStatus: label.status || nextStatus,
            note: "AfterShip booking completed and label stored",
        });

        return bookingResult;
    } catch (err) {
        const logisticRaw = buildManualOrderLogisticRawWithAfterShip({
            existing: existingRaw,
            selectedRate,
            sender,
            receiver,
            payment: body.payment || {},
            packageData: resolvePackageDimensions(body),
            content: afterShip.content || createdOrder.package_content || "Product",
            afterShip: {
                ...bookingResult,
                error: err.message || "AfterShip booking failed",
                errorResponse: err.afterShipResponse || null,
            },
        });
        await ManualOrder.update({
            status: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
            shipment_status: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
            booking_status: "BOOKING_FAILED",
            booking_error: err.message || "AfterShip booking failed",
            logistic_raw: logisticRaw,
            last_status_checked_at: new Date(),
            ...(isCancelledRebook ? {
                tracking_number: null,
                awb_number: null,
                provider_order_number: null,
                provider_shipment_number: null,
                parcel_number: null,
                waybill_pdf_url: null,
                waybill_pdf_filename: null,
                tracking_url: null,
            } : {}),
        }, { where: { id: createdOrder.id, company_id: user.companyId } });
        await createManualStatusHistory({
            user,
            order: createdOrder,
            oldStatus: createdOrder.status,
            newStatus: MANUAL_ORDER_STATUSES.BOOKING_FAILED,
            rawProviderStatus: "BOOKING_FAILED",
            note: err.message || "AfterShip booking failed",
        });
        const wrapped = new Error(`Manual order saved, but AfterShip booking failed: ${err.message}`);
        wrapped.statusCode = err.statusCode || 502;
        wrapped.manualOrderSaved = true;
        throw wrapped;
    }
};

const getManualOrderDropdowns = async (user) => {
    const { Warehouse } = require("../../models");
    const companyId = resolveCompanyId(user);

    const warehouses = await Warehouse.findAll({
        where: { company_id: companyId, status: "active" },
        attributes: ["id", "name", "code", "location", "city", "country", "manager_name", "phone", "is_default"],
        order: [["is_default", "DESC"], ["name", "ASC"]],
        raw: true,
    });

    return {
        warehouses,
        easyParcelOriginCountries: [
            { code: "MY", name: "Malaysia", supported: true },
            { code: "SG", name: "Singapore", supported: true },
            { code: "TH", name: "Thailand", supported: true },
            { code: "ID", name: "Indonesia", supported: true },
        ],
        manualOrderStatuses: getManualOrderStatusOptions(),
        currencies: [
            { code: "USD", name: "US Dollar" },
            { code: "MYR", name: "Malaysian Ringgit" },
            { code: "SGD", name: "Singapore Dollar" },
            { code: "THB", name: "Thai Baht" },
            { code: "IDR", name: "Indonesian Rupiah" },
            { code: "BDT", name: "Bangladeshi Taka" },
            { code: "CNY", name: "Chinese Yuan" },
            { code: "PHP", name: "Philippine Peso" },
            { code: "VND", name: "Vietnamese Dong" },
        ],
    };
};

const searchWarehouseSkus = async (user, { warehouseId, search, page = 1, limit = 50, skuType = "sku_name" }) => {
    const { MerchantSku, SkuWarehouseStock, Warehouse } = require("../../models");
    const companyId = resolveCompanyId(user);
    const numericWarehouseId = Number(warehouseId);

    if (!Number.isInteger(numericWarehouseId) || numericWarehouseId <= 0) {
        const err = new Error("warehouseId is required");
        err.statusCode = 400;
        throw err;
    }

    const where = {
        company_id: companyId,
        status: "active",
        deleted_at: null,
    };

    const q = normalizeString(search);
    if (q) {
        where[Op.or] = [
            { sku_name: { [Op.like]: `%${q}%` } },
            { sku_title: { [Op.like]: `%${q}%` } },
        ];
        if (skuType === "product_name") {
            where[Op.or] = [
                { sku_title: { [Op.like]: `%${q}%` } },
                { sku_name: { [Op.like]: `%${q}%` } },
            ];
        }
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const { count, rows } = await MerchantSku.findAndCountAll({
        where,
        attributes: ["id", "sku_name", "sku_title", "image_url", "price", "weight", "length", "width", "height", "warehouse_id"],
        include: [
            {
                model: SkuWarehouseStock,
                as: "stock",
                required: true,
                where: { warehouse_id: numericWarehouseId, company_id: companyId },
                attributes: ["id", "warehouse_id", "qty_on_hand", "qty_reserved", "qty_inbound"],
                include: [
                    { model: Warehouse, as: "warehouse", attributes: ["id", "name", "code"], required: false },
                ],
            },
        ],
        order: [["sku_name", "ASC"]],
        limit: parseInt(limit, 10),
        offset,
        distinct: true,
    });

    return {
        data: rows.map((sku) => {
            const stock = Array.isArray(sku.stock) ? sku.stock[0] : sku.stock;
            const qtyOnHand = Number(stock?.qty_on_hand || 0);
            const qtyReserved = Number(stock?.qty_reserved || 0);
            const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);
            return {
                id: sku.id,
                merchant_sku_id: sku.id,
                sku_name: sku.sku_name,
                sku_title: sku.sku_title,
                product_name: sku.sku_title,
                image_url: sku.image_url || DEFAULT_IMAGE,
                price: Number(sku.price || 0),
                weight: Number(sku.weight || 0),
                length: Number(sku.length || 0),
                width: Number(sku.width || 0),
                height: Number(sku.height || 0),
                warehouse_id: stock?.warehouse_id || numericWarehouseId,
                warehouse_name: stock?.warehouse?.name || null,
                stock_id: stock?.id || null,
                qty_on_hand: qtyOnHand,
                total_available: qtyOnHand,
                qty_reserved: qtyReserved,
                lock_quantity: qtyReserved,
                qty_inbound: Number(stock?.qty_inbound || 0),
                qty_available: qtyAvailable,
                available_for_platform: qtyAvailable,
                available_inventory: qtyAvailable,
            };
        }),
        pagination: {
            total: count,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalPages: Math.ceil(count / parseInt(limit, 10)),
        },
    };
};

const toManualOrderApi = (order) => {
    const plain = order?.toJSON ? order.toJSON() : order || {};
    const logisticRaw = plain.logistic_raw && typeof plain.logistic_raw === "object" ? plain.logistic_raw : {};
    const easyParcel = logisticRaw.easyParcel || logisticRaw.easyparcel || null;
    const afterShip = logisticRaw.afterShip || logisticRaw.aftership || null;
    const items = (plain.items || []).map((item) => ({
        id: item.id,
        merchantSkuId: item.merchant_sku_id,
        sku: item.sku,
        productName: item.product_name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        weight: Number(item.weight || 0),
        lineTotal: Number(item.line_total || 0),
        image: item.image_url || item.merchantSku?.image_url || DEFAULT_IMAGE,
    }));

    const rawStatus = normalizeManualStatus(plain.status || plain.shipment_status, MANUAL_ORDER_STATUSES.CREATED);
    const shipmentStatus = normalizeManualStatus(plain.shipment_status || rawStatus, rawStatus);
    const waybillPdfUrl = plain.waybill_pdf_url || easyParcel?.awbLink || easyParcel?.waybillPdfUrl || easyParcel?.pdfUrl || afterShip?.labelUrl || afterShip?.waybillPdfUrl || "";
    const awb = plain.awb_number || plain.tracking_number || easyParcel?.awb || easyParcel?.parcelNumber || afterShip?.trackingNumber || "";
    const sender = logisticRaw.sender || {
        senderName: plain.sender_name,
        company: plain.sender_company,
        phone: plain.sender_phone,
        email: plain.sender_email,
        address: plain.sender_address,
        country: plain.sender_country,
        state: plain.sender_state,
        city: plain.sender_city,
        postcode: plain.sender_postcode,
        unit: plain.sender_unit,
    };
    const buyer = logisticRaw.receiver || {
        buyerName: plain.buyer_name,
        name: plain.buyer_name,
        phone: plain.buyer_phone,
        email: plain.receiver_email,
        address: plain.buyer_address,
        country: plain.buyer_country,
        state: plain.buyer_state,
        city: plain.buyer_city,
        area: plain.buyer_area,
        zipCode: plain.buyer_zip_code,
        unit: plain.buyer_unit,
    };

    return {
        id: plain.id,
        orderNumber: plain.order_number,
        orderNo: plain.order_number,
        type: plain.type,
        platform: "manual",
        platformLabel: plain.type === "gift" ? "Gift" : "Manual",
        warehouseId: plain.warehouse_id,
        warehouseName: plain.warehouse?.name || "",
        packageNo: plain.order_number,
        status: statusLabel(rawStatus),
        statusCode: rawStatus,
        rawStatus,
        shipmentStatus,
        shipmentStatusLabel: statusLabel(shipmentStatus),
        codStatus: plain.cod_status || COD_STATUSES.NOT_APPLICABLE,
        bookingStatus: plain.booking_status || "SAVED_ONLY",
        bookingError: plain.booking_error || easyParcel?.error || afterShip?.error || "",
        rawProviderStatus: plain.raw_provider_status || "",
        logisticCompany: plain.logistic_company || easyParcel?.courier || afterShip?.courier || "",
        logisticServiceId: plain.logistic_service_id || easyParcel?.serviceId || afterShip?.serviceType || afterShip?.serviceId || "",
        trackingNo: awb || "-",
        awbNumber: plain.awb_number || easyParcel?.awb || afterShip?.trackingNumber || "",
        providerOrderNumber: plain.provider_order_number || easyParcel?.orderNumber || afterShip?.labelId || "",
        providerShipmentNumber: plain.provider_shipment_number || easyParcel?.shipmentNumber || afterShip?.labelId || "",
        parcelNumber: plain.parcel_number || easyParcel?.parcelNumber || afterShip?.labelId || "",
        currency: plain.currency || easyParcel?.currency || afterShip?.currency || "USD",
        orderValue: Number(plain.order_value || 0),
        subtotal: Number(plain.subtotal || 0),
        shippingFee: Number(plain.shipping_fee || 0),
        discounts: Number(plain.discounts || 0),
        orderIncome: Number(plain.order_income || 0),
        paymentType: normalizePaymentType(plain.payment_type),
        codAmount: Number(plain.cod_amount || 0),
        codFee: Number(plain.cod_fee || 0),
        codSettlementAmount: Number(plain.cod_settlement_amount || 0),
        codPaidAmount: Number(plain.cod_paid_amount || 0),
        codPaidAt: plain.cod_paid_at,
        codPayoutReference: plain.cod_payout_reference || "",
        codSettlementNote: plain.cod_settlement_note || "",
        platformFee: Number(plain.platform_fee || 0),
        paymentCertificateUrl: plain.payment_certificate_url || logisticRaw.payment?.paymentCertificate?.url || "",
        paymentCertificateFilename: plain.payment_certificate_filename || logisticRaw.payment?.paymentCertificate?.filename || "",
        orderTime: plain.order_time,
        createdAt: plain.created_at,
        updatedAt: plain.updated_at,
        package: logisticRaw.package || {
            weight: Number(plain.package_weight || 0),
            length: Number(plain.package_length || 0),
            width: Number(plain.package_width || 0),
            height: Number(plain.package_height || 0),
            content: plain.package_content,
        },
        sender,
        easyParcel: easyParcel ? {
            orderNumber: easyParcel.orderNumber || plain.provider_order_number,
            shipmentNumber: easyParcel.shipmentNumber || plain.provider_shipment_number,
            parcelNumber: easyParcel.parcelNumber || plain.parcel_number,
            awb: easyParcel.awb || plain.awb_number,
            awbLink: easyParcel.awbLink || plain.waybill_pdf_url,
            trackingUrl: easyParcel.trackingUrl || plain.tracking_url,
            paid: easyParcel.paid,
            submitted: easyParcel.submitted,
            error: easyParcel.error || plain.booking_error,
            currency: easyParcel.currency || plain.currency,
        } : (!afterShip && (waybillPdfUrl || awb) ? {
            orderNumber: plain.provider_order_number,
            shipmentNumber: plain.provider_shipment_number,
            parcelNumber: plain.parcel_number,
            awb: plain.awb_number,
            awbLink: waybillPdfUrl,
            trackingUrl: plain.tracking_url,
            submitted: Boolean(plain.provider_order_number || plain.provider_shipment_number || plain.awb_number),
            paid: Boolean(waybillPdfUrl || plain.awb_number),
        } : null),
        afterShip: afterShip ? {
            labelId: afterShip.labelId || plain.provider_order_number,
            trackingNumber: afterShip.trackingNumber || plain.tracking_number || plain.awb_number,
            labelUrl: afterShip.labelUrl || plain.waybill_pdf_url,
            trackingUrl: afterShip.trackingUrl || plain.tracking_url,
            courier: afterShip.courier || plain.logistic_company,
            courierSlug: afterShip.courierSlug || "",
            serviceType: afterShip.serviceType || plain.logistic_service_id,
            shipperAccountId: afterShip.shipperAccountId || "",
            submitted: afterShip.submitted,
            error: afterShip.error || plain.booking_error,
            currency: afterShip.currency || plain.currency,
        } : null,
        waybillPdfUrl,
        waybillPdfFilename: plain.waybill_pdf_filename || manualWaybillFilename(plain.order_number),
        trackingUrl: plain.tracking_url || easyParcel?.trackingUrl || afterShip?.trackingUrl || "",
        buyer,
        customer: buyer,
        statusHistory: (plain.statusHistory || []).map((history) => ({
            id: history.id,
            oldStatus: history.old_status,
            newStatus: history.new_status,
            rawProviderStatus: history.raw_provider_status,
            note: history.note,
            createdAt: history.created_at,
        })),
        items,
        raw: plain,
    };
};

const listManualOrders = async (user, query = {}) => {
    const { ManualOrder, ManualOrderItem, MerchantSku, Warehouse } = require("../../models");
    const companyId = resolveCompanyId(user);
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 100, 10);
    const offset = (page - 1) * limit;
    const status = normalizeString(query.status || query.shipmentStatus);
    const type = normalizeString(query.type);
    const paymentType = normalizeString(query.paymentType || query.payment_type);
    const provider = normalizeString(query.provider || query.logisticProvider || query.logistic_provider).toLowerCase();
    const country = normalizeString(query.country || query.senderCountry || query.sender_country);
    const dateFieldRaw = normalizeString(query.dateField || query.date_field || "created_at");
    const dateField = ["created_at", "updated_at", "order_time"].includes(dateFieldRaw) ? dateFieldRaw : "created_at";
    const dateFrom = formatDateTime(query.dateFrom || query.date_from || query.createdAtMin || query.created_at_min);
    const dateTo = formatDateTime(query.dateTo || query.date_to || query.createdAtMax || query.created_at_max);

    const where = { company_id: companyId };
    const andConditions = [];
    if (status && status.toUpperCase() !== "ALL") {
        where.status = normalizeManualStatus(status);
    }
    if (type && type.toUpperCase() !== "ALL") where.type = type;
    if (paymentType && paymentType.toUpperCase() !== "ALL") where.payment_type = normalizePaymentType(paymentType);
    if (country && country.toUpperCase() !== "ALL") {
        const normalizedCountry = normalizeCountryCode(country, "MY");
        andConditions.push({
            [Op.or]: [
            { sender_country: normalizedCountry },
            { easyparcel_country: normalizedCountry },
            { buyer_country: normalizedCountry },
            ],
        });
    }
    if (dateFrom || dateTo) {
        where[dateField] = {
            ...(dateFrom ? { [Op.gte]: dateFrom } : {}),
            ...(dateTo ? { [Op.lte]: dateTo } : {}),
        };
    }
    if (provider === "aftership") {
        andConditions.push(sequelize.where(sequelize.fn("JSON_EXTRACT", sequelize.col("logistic_raw"), "$.afterShip"), { [Op.ne]: null }));
    } else if (provider === "easyparcel") {
        andConditions.push(sequelize.where(sequelize.fn("JSON_EXTRACT", sequelize.col("logistic_raw"), "$.easyParcel"), { [Op.ne]: null }));
    }

    const search = normalizeString(query.search);
    if (search) {
        andConditions.push({
            [Op.or]: [
            { order_number: { [Op.like]: `%${search}%` } },
            { buyer_name: { [Op.like]: `%${search}%` } },
            { buyer_phone: { [Op.like]: `%${search}%` } },
            { tracking_number: { [Op.like]: `%${search}%` } },
            { awb_number: { [Op.like]: `%${search}%` } },
            { provider_order_number: { [Op.like]: `%${search}%` } },
            ],
        });
    }
    if (andConditions.length) where[Op.and] = andConditions;

    const include = [
        { model: Warehouse, as: "warehouse", attributes: ["id", "name", "code", "location", "city", "country"], required: false },
        {
            model: ManualOrderItem,
            as: "items",
            include: [{ model: MerchantSku, as: "merchantSku", attributes: ["id", "sku_name", "sku_title", "image_url"], required: false }],
            required: false,
        },
    ];
    const liveStatusRequested = normalizeString(query.liveStatus ?? query.live_status ?? "true").toLowerCase() !== "false";
    const canUseLiveStatusFilter = liveStatusRequested && status && status.toUpperCase() !== "ALL";

    if (canUseLiveStatusFilter) {
        delete where.status;
    }

    const { count, rows } = await ManualOrder.findAndCountAll({
        where,
        include,
        order: [["created_at", "DESC"]],
        limit,
        offset,
        distinct: true,
    });

    let trackingMap = new Map();
    let liveStatusError = "";
    if (liveStatusRequested) {
        const byCountry = rows.reduce((acc, order) => {
            const raw = getOrderLogisticRaw(order);
            if (raw.afterShip || raw.aftership) return acc;
            const country = normalizeCountryCode(order.easyparcel_country || order.sender_country || "MY", "MY");
            const awb = normalizeString(order.awb_number || order.tracking_number);
            if (!awb) return acc;
            acc[country] = acc[country] || [];
            acc[country].push(awb);
            return acc;
        }, {});

        for (const [country, awbs] of Object.entries(byCountry)) {
            try {
                const config = getEasyParcelConfig(country);
                const countryMap = await fetchEasyParcelTrackingStatusMap({ config, awbNumbers: awbs });
                countryMap.forEach((value, key) => trackingMap.set(key, value));
            } catch (err) {
                liveStatusError = err.message || "EasyParcel live status lookup failed";
            }
        }
    }

    let data = rows.map((row) => {
        const apiOrder = toManualOrderApi(row);
        const raw = getOrderLogisticRaw(row);
        if (liveStatusRequested && (raw.afterShip || raw.aftership)) return apiOrder;
        const awb = normalizeString(apiOrder.awbNumber || apiOrder.trackingNo);
        return overlayManualOrderWithLiveTracking(apiOrder, trackingMap.get(awb));
    });

    if (liveStatusRequested) {
        for (const row of rows) {
            const raw = getOrderLogisticRaw(row);
            if (!raw.afterShip && !raw.aftership) continue;
            const apiOrderIndex = data.findIndex((item) => Number(item.id) === Number(row.id));
            if (apiOrderIndex < 0) continue;
            try {
                const senderCountry = normalizeCountryCode(raw.afterShip?.originCountry || raw.aftership?.originCountry || row.sender_country || row.easyparcel_country || "MY", "MY");
                const latest = await fetchAfterShipLatestStatus({ config: getAfterShipConfig(senderCountry), order: row });
                data[apiOrderIndex] = overlayManualOrderWithAfterShipTracking(data[apiOrderIndex], {
                    ok: true,
                    normalizedStatus: latest.normalizedStatus,
                    rawStatus: latest.rawStatus,
                    trackingId: latest.trackingId,
                    trackingNumber: latest.trackingNumber,
                    slug: latest.slug,
                    raw: latest.parsed?.raw,
                });
            } catch (err) {
                liveStatusError = liveStatusError || err.message || "AfterShip live status lookup failed";
            }
        }
    }

    if (canUseLiveStatusFilter) {
        const wantedStatus = normalizeManualStatus(status);
        data = data.filter((order) => normalizeManualStatus(order.statusCode || order.shipmentStatus || order.status) === wantedStatus);
    }

    const statusCounts = await ManualOrder.findAll({
        where: { company_id: companyId },
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["status"],
        raw: true,
    }).catch(() => []);

    return {
        data,
        statusOptions: getManualOrderStatusOptions(),
        statusCounts: statusCounts.reduce((acc, row) => {
            acc[normalizeManualStatus(row.status)] = Number(row.count || 0);
            return acc;
        }, {}),
        liveStatus: {
            enabled: liveStatusRequested,
            source: provider === "aftership" ? "AfterShip Tracking API" : "EasyParcel tracking_status / AfterShip Tracking API",
            error: liveStatusError || null,
        },
        pagination: { total: canUseLiveStatusFilter ? data.length : count, page, limit, totalPages: Math.ceil((canUseLiveStatusFilter ? data.length : count) / limit) },
    };
};

const listAfterShipManualParcels = async (user, query = {}) => listManualOrders(user, {
    ...query,
    provider: "aftership",
});

const getManualOrderDetail = async (user, id) => {
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const apiOrder = toManualOrderApi(order);
    const raw = getOrderLogisticRaw(order);
    const afterShip = raw.afterShip || raw.aftership || null;
    if (afterShip) {
        const senderCountry = normalizeCountryCode(afterShip.originCountry || order.sender_country || order.easyparcel_country || "MY", "MY");
        const config = getAfterShipConfig(senderCountry);
        const labelId = normalizeString(afterShip.labelId || order.provider_order_number || order.provider_shipment_number);
        const liveAfterShip = {};
        try {
            if (labelId) {
                const labelResponse = await callAfterShipApi(config, { method: "GET", path: `/labels/${encodeURIComponent(labelId)}` });
                liveAfterShip.label = parseAfterShipLabelResult(labelResponse);
                liveAfterShip.labelResponse = labelResponse;
            }
        } catch (err) {
            liveAfterShip.labelError = err.message || "AfterShip label details failed";
        }
        try {
            const latest = await fetchAfterShipLatestStatus({ config, order });
            return {
                ...overlayManualOrderWithAfterShipTracking(apiOrder, {
                    ok: true,
                    normalizedStatus: latest.normalizedStatus,
                    rawStatus: latest.rawStatus,
                    trackingId: latest.trackingId,
                    trackingNumber: latest.trackingNumber,
                    slug: latest.slug,
                    raw: latest.parsed?.raw,
                }),
                liveAfterShip: {
                    ...liveAfterShip,
                    tracking: latest.parsed,
                },
            };
        } catch (err) {
            return {
                ...apiOrder,
                liveAfterShip: {
                    ...liveAfterShip,
                    trackingError: err.message || "AfterShip live tracking failed",
                },
            };
        }
    }
    const shipmentNumber = normalizeString(order.provider_shipment_number || apiOrder.providerShipmentNumber);
    if (!shipmentNumber) return apiOrder;

    try {
        const config = getEasyParcelConfig(order.easyparcel_country || order.sender_country || "MY");
        const response = await callEasyParcelOpenApi(config, {
            method: "POST",
            path: `/open_api/${config.openApiVersion}/shipment/details`,
            data: { shipment_number: shipmentNumber },
        });
        const shipment = normalizeEasyParcelShipmentDetails(response, shipmentNumber);
        return {
            ...overlayManualOrderWithShipmentDetails(apiOrder, shipment),
            liveEasyParcelResponse: response,
        };
    } catch (err) {
        return {
            ...apiOrder,
            liveEasyParcel: {
                source: "shipment_details",
                error: err.message || "EasyParcel live shipment details failed",
            },
        };
    }
};

const createManualOrder = async (user, body) => {
    const { Warehouse, MerchantSku, SkuWarehouseStock, StockLedgerEntry, ManualOrder, ManualOrderItem, PlatformSkuMapping } = require("../../models");
    const companyId = resolveCompanyId(user);
    const warehouseId = Number(body.warehouseId || body.warehouse_id);
    const type = body.type === "gift" ? "gift" : "manual_order";
    const items = Array.isArray(body.items) ? body.items : [];
    const easyParcel = body.easyParcel || {};
    const afterShip = body.afterShip || body.aftership || {};
    const selectedRate = afterShip.selectedRate || easyParcel.selectedRate || body.logisticRaw || body.logistic_raw || {};
    const afterShipBookNow = normalizeBool(afterShip.bookNow ?? afterShip.submitNow ?? afterShip.createLabel ?? body.afterShipBookNow, false);
    const easyParcelBookNow = !afterShipBookNow && normalizeBool(easyParcel.bookNow, false);
    const bookingRequested = afterShipBookNow || easyParcelBookNow;

    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
        const err = new Error("warehouseId is required");
        err.statusCode = 400;
        throw err;
    }
    if (!items.length) {
        const err = new Error("At least one order item is required");
        err.statusCode = 400;
        throw err;
    }

    const warehouse = await Warehouse.findOne({ where: { id: warehouseId, company_id: companyId, status: "active" } });
    if (!warehouse) {
        const err = new Error("Warehouse not found");
        err.statusCode = 404;
        throw err;
    }

    const orderNumber = normalizeString(body.orderNumber || body.order_number) || generateOrderNumber(type);
    const buyer = body.buyer || {};
    const payment = body.payment || {};
    const pkg = body.package || body.packageData || {};
    const sender = getWarehouseSender(warehouse.toJSON ? warehouse.toJSON() : warehouse, afterShip.sender || easyParcel.sender || body.sender || {});
    const receiver = getBuyerReceiver({ ...buyer, email: afterShip.receiverEmail || easyParcel.receiverEmail || buyer.email }, sender.country);
    const senderCountry = normalizeCountryCode(sender.country || warehouse.country || "MY", "MY");
    const receiverCountry = normalizeCountryCode(receiver.country || senderCountry, senderCountry);
    const paymentType = normalizeManualOrderPaymentType(payment);
    const isCod = paymentType === "COD";
    const codAmount = isCod ? Math.max(1, moneyNumber(payment.codAmount || afterShip.parcelValue || easyParcel.parcelValue || payment.orderValue || payment.subtotal || 0)) : 0;
    const selectedPrice = toNumber(selectedRate.price || selectedRate.shipmentPrice || 0);
    const orderTime = formatDateTime(body.orderTime || body.order_time) || new Date();
    const packageData = resolvePackageDimensions(body);
    const packageContent = trimMax(afterShip.content || easyParcel.content || body.packageContent || body.content || "Product", 255);
    const paymentCertificate = await saveManualPaymentCertificate({
        certificate: body.paymentCertificate || payment.paymentCertificate || payment.payment_certificate,
        orderNumber,
    });
    const createdItems = [];
    const affectedMerchantSkuIds = [];
    const platformStockDeductionItems = [];
    let createdOrder;

    await sequelize.transaction(async (transaction) => {
        const logisticRaw = buildManualOrderLogisticRaw({
            selectedRate,
            sender,
            receiver,
            payment: { ...payment, paymentType, codAmount, paymentCertificate },
            packageData,
            content: packageContent,
            easyParcel: easyParcelBookNow ? { requested: true, openApi: true } : null,
            afterShip: afterShipBookNow ? {
                requested: true,
                api: "aftership-shipping",
                submitNow: true,
                selectedRate,
                shipperAccountId: afterShip.shipperAccountId || selectedRate.shipperAccountId,
                serviceType: afterShip.serviceType || selectedRate.serviceType || selectedRate.serviceId,
                courierSlug: afterShip.courierSlug || selectedRate.courierSlug,
            } : undefined,
        });

        createdOrder = await ManualOrder.create({
            company_id: companyId,
            warehouse_id: warehouseId,
            order_number: orderNumber,
            type,
            status: bookingRequested ? MANUAL_ORDER_STATUSES.BOOKING_PENDING : MANUAL_ORDER_STATUSES.CREATED,
            shipment_status: bookingRequested ? MANUAL_ORDER_STATUSES.BOOKING_PENDING : MANUAL_ORDER_STATUSES.CREATED,
            cod_status: isCod ? COD_STATUSES.PENDING_COLLECTION : COD_STATUSES.NOT_APPLICABLE,
            booking_status: bookingRequested ? "BOOKING_PENDING" : "SAVED_ONLY",
            logistic_service_id: normalizeString(body.logisticServiceId || body.logistic_service_id || selectedRate.serviceType || selectedRate.service_type || selectedRate.serviceId || selectedRate.service_id),
            logistic_company: normalizeString(body.logisticCompany || body.logistic || body.logistic_company || selectedRate.company || selectedRate.courier_name),
            logistic_raw: logisticRaw,
            currency: normalizeString(body.currency) || selectedRate.currency || AFTERSHIP_SUPPORTED_COUNTRIES[senderCountry]?.currency || EASY_PARCEL_SUPPORTED_COUNTRIES[senderCountry]?.currency || "USD",
            easyparcel_country: senderCountry,
            sender_name: sender.senderName,
            sender_company: sender.company,
            sender_phone: sender.phone,
            sender_email: sender.email,
            sender_address: sender.address,
            sender_country: senderCountry,
            sender_state: sender.state,
            sender_city: sender.city,
            sender_postcode: sender.postcode,
            sender_unit: sender.unit,
            receiver_email: receiver.email,
            buyer_name: receiver.name,
            buyer_phone: receiver.phone,
            buyer_address: receiver.address,
            buyer_country: receiverCountry,
            buyer_state: receiver.state,
            buyer_city: receiver.city,
            buyer_area: receiver.area || buyer.area,
            buyer_zip_code: receiver.postcode,
            buyer_unit: receiver.unit,
            payment_type: paymentType,
            order_income: toNumber(payment.orderIncome),
            subtotal: toNumber(payment.subtotal),
            discounts: toNumber(payment.discounts),
            shipping_fee: toNumber(payment.shippingFee) || selectedPrice,
            order_value: toNumber(payment.orderValue),
            cod_amount: codAmount,
            cod_fee: toNumber(payment.codFee),
            platform_fee: toNumber(payment.platformFee),
            payment_certificate_url: paymentCertificate.url || null,
            payment_certificate_filename: paymentCertificate.filename || null,
            order_time: orderTime,
            package_weight: packageData.weight,
            package_length: packageData.length,
            package_width: packageData.width,
            package_height: packageData.height,
            package_content: packageContent,
            created_by: user.userId || user.id || null,
        }, { transaction });

        await createManualStatusHistory({
            user,
            order: createdOrder,
            oldStatus: null,
            newStatus: createdOrder.status,
            rawProviderStatus: "",
            note: afterShipBookNow
                ? "Manual order saved; AfterShip label requested"
                : easyParcelBookNow
                    ? "Manual order saved; EasyParcel booking requested"
                    : "Manual order saved only",
            transaction,
        });

        for (const item of items) {
            const merchantSkuId = Number(item.merchantSkuId || item.merchant_sku_id || item.skuId || item.id);
            const quantity = toPositiveInt(item.quantity || item.qty, "item quantity");
            const unitPrice = type === "gift" ? 0 : toNumber(item.unitPrice || item.unit_price);

            if (!Number.isInteger(merchantSkuId) || merchantSkuId <= 0) {
                const err = new Error("Each item must include merchantSkuId/skuId");
                err.statusCode = 400;
                throw err;
            }

            const sku = await MerchantSku.findOne({
                where: { id: merchantSkuId, company_id: companyId, deleted_at: null, status: "active" },
                transaction,
            });
            if (!sku) {
                const err = new Error(`Merchant SKU ${merchantSkuId} not found`);
                err.statusCode = 404;
                throw err;
            }

            const stockRecord = await SkuWarehouseStock.findOne({
                where: { company_id: companyId, merchant_sku_id: merchantSkuId, warehouse_id: warehouseId },
                lock: transaction.LOCK.UPDATE,
                transaction,
            });
            if (!stockRecord) {
                const err = new Error(`No stock record for ${sku.sku_name} in selected warehouse`);
                err.statusCode = 400;
                throw err;
            }

            const qtyOnHand = Number(stockRecord.qty_on_hand || 0);
            const qtyReserved = Number(stockRecord.qty_reserved || 0);
            const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);
            if (qtyAvailable < quantity) {
                const err = new Error(`Insufficient available stock for ${sku.sku_name}: available ${qtyAvailable}, requested ${quantity}`);
                err.statusCode = 400;
                throw err;
            }

            const newQtyOnHand = qtyOnHand - quantity;
            await stockRecord.update({ qty_on_hand: newQtyOnHand }, { transaction });

            await StockLedgerEntry.create({
                company_id: companyId,
                merchant_sku_id: merchantSkuId,
                warehouse_id: warehouseId,
                sku_warehouse_stock_id: stockRecord.id,
                movement_type: "sale_deduction",
                quantity_delta: -quantity,
                qty_on_hand_after: newQtyOnHand,
                reference_type: "manual_order",
                reference_id: orderNumber,
                notes: type === "gift" ? "Gift order stock deduction" : "Manual order stock deduction",
                created_by: user.userId || user.id || null,
            }, { transaction });

            const line = await ManualOrderItem.create({
                company_id: companyId,
                manual_order_id: createdOrder.id,
                merchant_sku_id: merchantSkuId,
                warehouse_id: warehouseId,
                sku: sku.sku_name,
                product_name: item.productName || item.name || sku.sku_title,
                quantity,
                unit_price: unitPrice,
                weight: toNumber(item.weight || sku.weight),
                line_total: unitPrice * quantity,
                image_url: item.image || item.imageUrl || sku.image_url,
                qty_on_hand_before: qtyOnHand,
                qty_on_hand_after: newQtyOnHand,
            }, { transaction });
            createdItems.push(line);
            affectedMerchantSkuIds.push(merchantSkuId);
            platformStockDeductionItems.push({ merchantSkuId, warehouseId, quantity });
        }

        if (affectedMerchantSkuIds.length) {
            await PlatformSkuMapping.update(
                { sync_status: "out_of_sync", sync_error: null },
                {
                    where: {
                        company_id: companyId,
                        is_active: true,
                        merchant_sku_id: { [Op.in]: [...new Set(affectedMerchantSkuIds)] },
                    },
                    transaction,
                }
            );
        }
    });

    const uniqueAffectedMerchantSkuIds = [...new Set(affectedMerchantSkuIds)];
    let platformStockSync = null;
    let platformStockSyncError = null;

    if (uniqueAffectedMerchantSkuIds.length) {
        try {
            const [shopeeSync, tiktokSync] = await Promise.all([
                platformOrderDeductionsService.pushManualOrderPlatformStockDeduction({
                    companyId,
                    items: platformStockDeductionItems,
                    platform: "shopee",
                }),
                platformOrderDeductionsService.pushManualOrderPlatformStockDeduction({
                    companyId,
                    items: platformStockDeductionItems,
                    platform: "tiktok",
                }),
            ]);

            platformStockSync = {
                shopee: shopeeSync,
                tiktok: tiktokSync,
                total: Number(shopeeSync?.total || 0) + Number(tiktokSync?.total || 0),
                synced: Number(shopeeSync?.synced || 0) + Number(tiktokSync?.synced || 0),
                failed: Number(shopeeSync?.failed || 0) + Number(tiktokSync?.failed || 0),
            };
        } catch (err) {
            platformStockSyncError = err.message || "Platform stock sync failed";
        }
    }

    let easyParcelBooking = null;
    let easyParcelError = null;
    let afterShipBooking = null;
    let afterShipError = null;
    if (afterShipBookNow) {
        try {
            afterShipBooking = await bookAfterShipShipment({
                user,
                warehouse: warehouse.toJSON ? warehouse.toJSON() : warehouse,
                body: {
                    ...body,
                    afterShip: {
                        ...afterShip,
                        bookNow: true,
                        submitNow: true,
                        sender,
                        receiverEmail: receiver.email,
                        selectedRate,
                        content: packageContent,
                        parcelValue: Math.max(1, moneyNumber(codAmount || payment.orderValue || payment.subtotal || 1)),
                    },
                },
                createdOrder,
                type,
            });
        } catch (err) {
            afterShipError = err.message || "AfterShip booking failed";
        }
    } else if (easyParcelBookNow) {
        try {
            easyParcelBooking = await bookEasyParcelShipment({ user, warehouse: warehouse.toJSON ? warehouse.toJSON() : warehouse, body, createdOrder, type });
        } catch (err) {
            easyParcelError = err.message || "EasyParcel booking failed";
        }
    }

    const order = await findManualOrderForUser(user, createdOrder.id, { includeHistory: true });
    const apiOrder = toManualOrderApi(order);

    return {
        message: afterShipError
            ? `${type === "gift" ? "Gift" : "Manual"} order saved, but AfterShip label creation failed. You can push it again from Manual Order list.`
            : easyParcelError
                ? `${type === "gift" ? "Gift" : "Manual"} order saved, but EasyParcel booking failed. You can push it again from Manual Order list.`
                : afterShipBooking
                    ? `${type === "gift" ? "Gift" : "Manual"} order created and AfterShip label generated successfully`
                    : easyParcelBooking
                        ? `${type === "gift" ? "Gift" : "Manual"} order created and EasyParcel shipment booked successfully`
                : `${type === "gift" ? "Gift" : "Manual"} order saved successfully`,
        order: apiOrder,
        easyParcel: easyParcelBooking || apiOrder.easyParcel,
        afterShip: afterShipBooking || apiOrder.afterShip,
        waybillPdfUrl: apiOrder.waybillPdfUrl,
        waybillPdfFilename: apiOrder.waybillPdfFilename,
        easyParcelError,
        afterShipError,
        platformStockSync,
        platformStockSyncError,
        itemCount: createdItems.length,
    };
};

const submitManualOrderToEasyParcel = async (user, id) => {
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const current = toManualOrderApi(order);
    const isCancelledForRepush = normalizeManualStatus(order.status) === MANUAL_ORDER_STATUSES.CANCELLED;
    if (!isCancelledForRepush && (current.waybillPdfUrl || current.awbNumber || current.easyParcel?.awbLink)) {
        return {
            message: "Stored EasyParcel waybill is ready",
            order: current,
            easyParcel: current.easyParcel,
            waybillPdfUrl: current.waybillPdfUrl,
            waybillPdfFilename: current.waybillPdfFilename,
        };
    }

    const body = buildStoredManualOrderBody(order);
    let easyParcelBooking = null;
    let easyParcelError = null;
    try {
        easyParcelBooking = await bookEasyParcelShipment({
            user,
            warehouse: order.warehouse?.toJSON ? order.warehouse.toJSON() : order.warehouse,
            body,
            createdOrder: order,
            type: order.type,
        });
    } catch (err) {
        easyParcelError = err.message || "EasyParcel booking failed";
    }

    const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
    const apiOrder = toManualOrderApi(updatedOrder);
    return {
        message: easyParcelError
            ? "EasyParcel booking failed. The manual order is still saved and can be pushed again."
            : "EasyParcel shipment booked successfully",
        order: apiOrder,
        easyParcel: easyParcelBooking || apiOrder.easyParcel,
        waybillPdfUrl: apiOrder.waybillPdfUrl,
        waybillPdfFilename: apiOrder.waybillPdfFilename,
        easyParcelError,
    };
};

const submitManualOrderToAfterShip = async (user, id) => {
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const current = toManualOrderApi(order);
    const raw = getOrderLogisticRaw(order);
    const existingAfterShip = raw.afterShip || raw.aftership || null;
    const isCancelledForRepush = normalizeManualStatus(order.status) === MANUAL_ORDER_STATUSES.CANCELLED;
    if (!isCancelledForRepush && existingAfterShip && (existingAfterShip.labelUrl || existingAfterShip.trackingNumber || existingAfterShip.labelId)) {
        return {
            message: "Stored AfterShip label is ready",
            order: current,
            afterShip: current.afterShip,
            waybillPdfUrl: current.waybillPdfUrl,
            waybillPdfFilename: current.waybillPdfFilename,
        };
    }

    const body = buildStoredManualOrderBody(order);
    body.afterShip = {
        ...(raw.afterShip || {}),
        submitNow: true,
        sender: body.sender,
        receiverEmail: body.buyer?.email || order.receiver_email,
        selectedRate: raw.selectedRate || body.logisticRaw || {},
        content: order.package_content || raw.content || "Product",
        parcelValue: Math.max(1, moneyNumber(order.cod_amount || order.order_value || order.subtotal || 1)),
    };

    let afterShipBooking = null;
    let afterShipError = null;
    try {
        afterShipBooking = await bookAfterShipShipment({
            user,
            warehouse: order.warehouse?.toJSON ? order.warehouse.toJSON() : order.warehouse,
            body,
            createdOrder: order,
            type: order.type,
        });
    } catch (err) {
        afterShipError = err.message || "AfterShip booking failed";
    }

    const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
    const apiOrder = toManualOrderApi(updatedOrder);
    return {
        message: afterShipError
            ? "AfterShip booking failed. The manual order is still saved and can be pushed again."
            : "AfterShip label created successfully",
        order: apiOrder,
        afterShip: afterShipBooking || apiOrder.afterShip,
        waybillPdfUrl: apiOrder.waybillPdfUrl,
        waybillPdfFilename: apiOrder.waybillPdfFilename,
        afterShipError,
    };
};

const parseAfterShipTracking = (response) => {
    const data = response?.data?.tracking || response?.data || response?.tracking || response || {};
    const checkpoint = data.latest_checkpoint || data.latestCheckpoint || {};
    const rawStatus = normalizeString(data.tag || data.subtag || data.status || checkpoint.tag || checkpoint.status);
    return {
        trackingId: normalizeString(data.id),
        trackingNumber: normalizeString(data.tracking_number || data.trackingNumber),
        slug: normalizeString(data.slug || data.courier_slug),
        rawStatus,
        normalizedStatus: normalizeAfterShipTrackingStatus(rawStatus),
        checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
        raw: data,
        response,
    };
};

const getAfterShipTrackingIdentifier = (order) => {
    const raw = getOrderLogisticRaw(order);
    const afterShip = raw.afterShip || raw.aftership || {};
    return {
        trackingId: normalizeString(afterShip.trackingId || afterShip.tracking_id),
        trackingNumber: normalizeString(afterShip.trackingNumber || order.tracking_number || order.awb_number),
        slug: normalizeString(afterShip.courierSlug || afterShip.slug),
    };
};

const fetchAfterShipLatestStatus = async ({ config, order }) => {
    const ids = getAfterShipTrackingIdentifier(order);
    if (!ids.trackingNumber && !ids.trackingId) {
        const err = new Error("No AfterShip tracking number stored yet.");
        err.statusCode = 400;
        throw err;
    }

    let response;
    if (ids.trackingId) {
        response = await callAfterShipApi(config, {
            method: "GET",
            path: `/trackings/${encodeURIComponent(ids.trackingId)}`,
            product: "tracking",
        });
    } else {
        const createPayload = {
            tracking_number: ids.trackingNumber,
            ...(ids.slug ? { slug: ids.slug } : {}),
            title: order.order_number,
            order_id: order.order_number,
            custom_fields: {
                manual_order_id: String(order.id),
                provider: "aftership",
            },
        };
        try {
            response = await callAfterShipApi(config, {
                method: "POST",
                path: "/trackings",
                data: createPayload,
                product: "tracking",
            });
        } catch (err) {
            if (err.statusCode !== 409 && err.statusCode !== 400) throw err;
            response = await callAfterShipApi(config, {
                method: "GET",
                path: "/trackings",
                query: { tracking_numbers: ids.trackingNumber, slug: ids.slug || undefined },
                product: "tracking",
            });
        }
    }

    const parsed = parseAfterShipTracking(response);
    return {
        response,
        trackingId: parsed.trackingId || ids.trackingId,
        rawStatus: parsed.rawStatus,
        normalizedStatus: parsed.normalizedStatus || order.status,
        trackingNumber: parsed.trackingNumber || ids.trackingNumber,
        slug: parsed.slug || ids.slug,
        parsed,
    };
};

const refreshManualOrderAfterShipStatus = async (user, id) => {
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const raw = getOrderLogisticRaw(order);
    const afterShip = raw.afterShip || raw.aftership || {};
    const senderCountry = normalizeCountryCode(afterShip.originCountry || order.sender_country || order.easyparcel_country || "MY", "MY");
    const config = getAfterShipConfig(senderCountry);
    if (!afterShip.labelId && !order.awb_number && !order.tracking_number) {
        return { message: "No AfterShip label/tracking number stored yet", order: toManualOrderApi(order) };
    }
    if (FINAL_SHIPMENT_STATUSES.has(normalizeManualStatus(order.status))) {
        return { message: "Order already has final shipment status", order: toManualOrderApi(order) };
    }

    try {
        const latest = await fetchAfterShipLatestStatus({ config, order });
        const nextStatus = latest.normalizedStatus || order.status;
        await updateManualOrderLogisticsStatus({
            user,
            order,
            nextStatus,
            rawProviderStatus: latest.rawStatus || nextStatus,
            note: "Status refreshed from AfterShip Tracking API",
            updates: {
                booking_status: "BOOKED",
                booking_error: null,
                logistic_raw: {
                    ...raw,
                    afterShip: {
                        ...afterShip,
                        trackingId: latest.trackingId || afterShip.trackingId,
                        trackingNumber: latest.trackingNumber || afterShip.trackingNumber,
                        courierSlug: latest.slug || afterShip.courierSlug,
                        lastTrackingResponse: latest.response,
                        lastTrackingStatus: latest.rawStatus || nextStatus,
                    },
                },
            },
        });
        const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
        return { message: "Manual order AfterShip status refreshed", order: toManualOrderApi(updatedOrder), afterShipTracking: latest.parsed };
    } catch (err) {
        await updateManualOrderLogisticsStatus({
            user,
            order,
            nextStatus: order.status,
            rawProviderStatus: order.raw_provider_status,
            note: `AfterShip status refresh failed: ${err.message}`,
            updates: {
                booking_error: err.message || order.booking_error,
                logistic_raw: {
                    ...raw,
                    afterShip: {
                        ...afterShip,
                        error: err.message || "AfterShip status refresh failed",
                        errorResponse: err.afterShipResponse || null,
                    },
                },
            },
        });
        const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
        return { message: err.message || "AfterShip status refresh failed", order: toManualOrderApi(updatedOrder), afterShipError: err.message };
    }
};

const getAfterShipLabelDetails = async (user, body = {}) => {
    resolveCompanyId(user);
    const country = normalizeCountryCode(body.country || body.afterShipCountry || body.aftership_country || "MY", "MY");
    const config = getAfterShipConfig(country);
    const labelId = normalizeString(body.labelId || body.label_id || body.afterShipLabelId || body.aftership_label_id || body.orderId || body.order_id);
    if (!labelId) {
        const err = new Error("AfterShip labelId is required.");
        err.statusCode = 400;
        throw err;
    }
    const response = await callAfterShipApi(config, { method: "GET", path: `/labels/${encodeURIComponent(labelId)}` });
    return {
        message: "AfterShip label details fetched",
        country: config.country,
        labelId,
        label: parseAfterShipLabelResult(response),
        afterShipResponse: response,
    };
};

const cancelManualOrderAfterShip = async (user, id, { reason = "Cancelled from ERP manual order", remark = "" } = {}) => {
    const { ManualOrder } = require("../../models");
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const raw = getOrderLogisticRaw(order);
    const afterShip = raw.afterShip || raw.aftership || {};
    const senderCountry = normalizeCountryCode(afterShip.originCountry || order.sender_country || order.easyparcel_country || "MY", "MY");
    const config = getAfterShipConfig(senderCountry);
    const labelId = normalizeString(afterShip.labelId || order.provider_order_number || order.provider_shipment_number);
    if (!labelId) {
        const err = new Error("This manual order has no AfterShip label ID to cancel.");
        err.statusCode = 400;
        throw err;
    }

    const currentStatus = normalizeManualStatus(order.status);
    if (FINAL_SHIPMENT_STATUSES.has(currentStatus) || currentStatus === MANUAL_ORDER_STATUSES.CANCELLED) {
        const err = new Error("AfterShip cancellation is allowed only before final delivery/return/cancellation.");
        err.statusCode = 400;
        throw err;
    }

    const response = await callAfterShipApi(config, {
        method: "POST",
        path: "/cancel-labels",
        data: {
            label_id: labelId,
            reason: normalizeString(reason || remark || "Cancelled from ERP manual order"),
        },
    });
    const cancelData = response?.data?.cancel_label || response?.data || response || {};
    await ManualOrder.update({
        status: MANUAL_ORDER_STATUSES.CANCELLED,
        shipment_status: MANUAL_ORDER_STATUSES.CANCELLED,
        booking_status: "CANCELLED",
        raw_provider_status: normalizeString(cancelData.status || "CANCELLED"),
        booking_error: null,
        logistic_raw: {
            ...raw,
            afterShip: {
                ...afterShip,
                cancelled: true,
                cancelResponse: response,
            },
        },
        last_status_checked_at: new Date(),
    }, { where: { id: order.id, company_id: user.companyId } });
    await createManualStatusHistory({
        user,
        order,
        oldStatus: order.status,
        newStatus: MANUAL_ORDER_STATUSES.CANCELLED,
        rawProviderStatus: normalizeString(cancelData.status || "CANCELLED"),
        note: "AfterShip label cancelled from ERP",
    });
    const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
    return {
        message: "AfterShip label cancelled",
        order: toManualOrderApi(updatedOrder),
        afterShipCancel: cancelData,
    };
};

const createManualOrderAfterShipPickup = async (user, id, body = {}) => {
    const { ManualOrder } = require("../../models");
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const raw = getOrderLogisticRaw(order);
    const afterShip = raw.afterShip || raw.aftership || {};
    const senderCountry = normalizeCountryCode(afterShip.originCountry || order.sender_country || order.easyparcel_country || "MY", "MY");
    const config = getAfterShipConfig(senderCountry);
    const labelId = normalizeString(afterShip.labelId || order.provider_order_number || order.provider_shipment_number);
    const sender = raw.sender || {
        senderName: order.sender_name,
        name: order.sender_name,
        company: order.sender_company,
        phone: order.sender_phone,
        email: order.sender_email,
        address: order.sender_address,
        country: order.sender_country,
        state: order.sender_state,
        city: order.sender_city,
        postcode: order.sender_postcode,
        unit: order.sender_unit,
    };

    const payload = {
        pickup_date: normalizeString(body.pickupDate || body.pickup_date || todayDate()),
        pickup_start_time: normalizeString(body.pickupStartTime || body.pickup_start_time || "09:00:00"),
        pickup_end_time: normalizeString(body.pickupEndTime || body.pickup_end_time || "18:00:00"),
        pickup_from: toAfterShipAddress(sender, config.country),
        ...(labelId ? { label_ids: [labelId] } : {}),
    };

    if (!labelId) {
        const packageData = resolvePackageDimensions(buildStoredManualOrderBody(order));
        payload.shipper_account = { id: afterShip.shipperAccountId || config.defaultShipperAccountId };
        payload.pickup_parcels = [{
            weight: { value: packageData.weight, unit: "kg" },
            quantity: 1,
        }];
    }

    const response = await callAfterShipApi(config, { method: "POST", path: "/pickups", data: payload });
    const pickup = response?.data?.pickup || response?.data || response || {};
    await ManualOrder.update({
        logistic_raw: {
            ...raw,
            afterShip: {
                ...afterShip,
                pickupId: pickup.id || afterShip.pickupId,
                pickupResponse: response,
            },
        },
    }, { where: { id: order.id, company_id: user.companyId } });
    const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
    return {
        message: "AfterShip pickup created",
        order: toManualOrderApi(updatedOrder),
        pickup,
    };
};

const refreshManualOrderShipmentStatus = async (user, id) => {
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    const senderCountry = normalizeCountryCode(order.sender_country || order.easyparcel_country || "MY", "MY");
    const config = getEasyParcelConfig(senderCountry);
    if (!order.awb_number && !order.tracking_number && !order.parcel_number && !order.provider_shipment_number && !order.provider_order_number) {
        return { message: "No EasyParcel AWB/tracking number stored yet", order: toManualOrderApi(order) };
    }
    if (FINAL_SHIPMENT_STATUSES.has(normalizeManualStatus(order.status))) {
        if (order.booking_error || getOrderLogisticRaw(order)?.easyParcel?.error) {
            await updateManualOrderLogisticsStatus({
                user,
                order,
                nextStatus: order.status,
                rawProviderStatus: order.raw_provider_status,
                note: "Cleared stale EasyParcel tracking error for final shipment status",
                updates: {
                    booking_error: null,
                    logistic_raw: stripEasyParcelRefreshError(getOrderLogisticRaw(order)),
                },
            });
            const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
            return { message: "Order already has final shipment status", order: toManualOrderApi(updatedOrder) };
        }
        return { message: "Order already has final shipment status", order: toManualOrderApi(order) };
    }

    try {
        const latest = await fetchEasyParcelLatestStatus({ config, order });
        const nextStatus = latest.normalizedStatus || order.status;
        await updateManualOrderLogisticsStatus({
            user,
            order,
            nextStatus,
            rawProviderStatus: latest.rawStatus || nextStatus,
            note: "Status refreshed from EasyParcel tracking API",
            updates: {
                booking_status: "BOOKED",
                booking_error: null,
                logistic_raw: {
                    ...stripEasyParcelRefreshError(getOrderLogisticRaw(order)),
                    lastTrackingResponse: latest.response,
                    lastTrackingStatus: latest.rawStatus || nextStatus,
                    lastTrackingStatusCode: latest.rawStatusCode,
                },
            },
        });
        const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
        return { message: "Manual order status refreshed", order: toManualOrderApi(updatedOrder) };
    } catch (err) {
        await updateManualOrderLogisticsStatus({
            user,
            order,
            nextStatus: order.status,
            rawProviderStatus: order.raw_provider_status,
            note: `EasyParcel status refresh failed: ${err.message}`,
            updates: { booking_error: err.message || order.booking_error },
        });
        const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
        return { message: err.message || "EasyParcel status refresh failed", order: toManualOrderApi(updatedOrder), easyParcelError: err.message };
    }
};

const updateManualOrderCodSettlement = async (user, id, body = {}) => {
    const { ManualOrder } = require("../../models");
    const order = await findManualOrderForUser(user, id, { includeHistory: true });
    if (normalizePaymentType(order.payment_type) !== "COD") {
        const err = new Error("COD settlement can be updated only for COD manual orders.");
        err.statusCode = 400;
        throw err;
    }

    const requestedStatus = normalizeString(body.codStatus || body.cod_status || body.status || COD_STATUSES.SETTLEMENT_PENDING).toUpperCase();
    const allowedStatuses = new Set(Object.values(COD_STATUSES));
    const codStatus = allowedStatuses.has(requestedStatus) ? requestedStatus : COD_STATUSES.SETTLEMENT_PENDING;
    const codAmount = moneyNumber(order.cod_amount);
    const paidAmount = moneyNumber(body.paidAmount ?? body.paid_amount ?? body.codPaidAmount ?? body.cod_paid_amount ?? 0);
    const settlementAmount = moneyNumber(body.settlementAmount ?? body.settlement_amount ?? body.codSettlementAmount ?? body.cod_settlement_amount ?? paidAmount);
    const paidAt = formatDateTime(body.paidAt || body.paid_at) || (codStatus === COD_STATUSES.PAID_TO_COMPANY ? new Date() : null);
    const reference = normalizeString(body.reference || body.payoutReference || body.codPayoutReference || body.cod_payout_reference);
    const note = normalizeString(body.note || body.codSettlementNote || body.cod_settlement_note);

    if (codStatus === COD_STATUSES.PAID_TO_COMPANY && paidAmount <= 0) {
        const err = new Error("paidAmount is required when marking COD as paid to company.");
        err.statusCode = 400;
        throw err;
    }
    if (paidAmount > codAmount && codAmount > 0) {
        const err = new Error("paidAmount cannot be greater than the order COD amount.");
        err.statusCode = 400;
        throw err;
    }

    await ManualOrder.update({
        cod_status: codStatus,
        cod_settlement_amount: settlementAmount,
        cod_paid_amount: paidAmount,
        cod_paid_at: paidAt,
        cod_payout_reference: reference || null,
        cod_settlement_note: note || null,
    }, { where: { id: order.id, company_id: user.companyId } });

    await createManualStatusHistory({
        user,
        order,
        oldStatus: order.status,
        newStatus: order.status,
        rawProviderStatus: order.raw_provider_status,
        note: `COD settlement updated to ${codStatus}${reference ? `, reference ${reference}` : ""}`,
    });

    const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
    return {
        message: "Manual order COD settlement updated",
        order: toManualOrderApi(updatedOrder),
    };
};

const cancelManualOrderEasyParcel = async (user, id, { remark = "Cancelled from ERP manual order" } = {}) => {
    const { ManualOrder } = require("../../models");
    let order = await findManualOrderForUser(user, id, { includeHistory: true });
    const senderCountry = normalizeCountryCode(order.sender_country || order.easyparcel_country || "MY", "MY");
    const config = getEasyParcelConfig(senderCountry);
    const shipmentNumber = normalizeString(order.provider_shipment_number);

    if (!shipmentNumber) {
        const err = new Error("This manual order has no EasyParcel shipment number to cancel.");
        err.statusCode = 400;
        throw err;
    }

    let currentStatus = normalizeManualStatus(order.status);
    if (order.awb_number || order.tracking_number) {
        try {
            const latest = await fetchEasyParcelLatestStatus({ config, order });
            currentStatus = latest.normalizedStatus || currentStatus;
            if (currentStatus !== normalizeManualStatus(order.status)) {
                await updateManualOrderLogisticsStatus({
                    user,
                    order,
                    nextStatus: currentStatus,
                    rawProviderStatus: latest.rawStatus || currentStatus,
                    note: "Status refreshed before EasyParcel cancellation",
                    updates: {
                        booking_status: "BOOKED",
                        logistic_raw: {
                            ...getOrderLogisticRaw(order),
                            lastTrackingResponse: latest.response,
                        },
                    },
                });
                order = await findManualOrderForUser(user, id, { includeHistory: true });
            }
        } catch (err) {
            // If tracking refresh fails, keep the locally stored status and let the cancel endpoint decide.
        }
    }

    currentStatus = normalizeManualStatus(order.status);
    if (!CANCELLABLE_EASYPARCEL_STATUSES.has(currentStatus)) {
        const err = new Error("EasyParcel cancellation is allowed only before parcel collection. Current order status cannot be cancelled from ERP.");
        err.statusCode = 400;
        throw err;
    }

    const cancellation = await cancelEasyParcelShipment({ config, shipmentNumber, remark });
    const logisticRaw = getOrderLogisticRaw(order);
    const cancellations = Array.isArray(logisticRaw.cancellations) ? logisticRaw.cancellations : [];
    const easyParcel = logisticRaw.easyParcel && typeof logisticRaw.easyParcel === "object" ? logisticRaw.easyParcel : {};

    await ManualOrder.update({
        status: MANUAL_ORDER_STATUSES.CANCELLED,
        shipment_status: MANUAL_ORDER_STATUSES.CANCELLED,
        booking_status: "CANCELLED",
        raw_provider_status: cancellation.message || "Shipment Cancelled",
        booking_error: null,
        last_status_checked_at: new Date(),
        logistic_raw: {
            ...logisticRaw,
            easyParcel: {
                ...easyParcel,
                cancelled: true,
                cancellationResponse: cancellation.raw,
            },
            cancellations: [
                ...cancellations,
                {
                    at: new Date().toISOString(),
                    shipmentNumber,
                    remark,
                    response: cancellation.raw,
                },
            ],
        },
    }, { where: { id: order.id, company_id: user.companyId } });

    await createManualStatusHistory({
        user,
        order,
        oldStatus: order.status,
        newStatus: MANUAL_ORDER_STATUSES.CANCELLED,
        rawProviderStatus: cancellation.message || "Shipment Cancelled",
        note: "EasyParcel shipment cancelled before collection. This manual order can be pushed again to create a new EasyParcel shipment.",
    });

    const updatedOrder = await findManualOrderForUser(user, id, { includeHistory: true });
    return {
        message: "EasyParcel shipment cancelled. You can push this manual order again if needed.",
        order: toManualOrderApi(updatedOrder),
        cancellation: cancellation.raw,
    };
};

const finalizePackedPlatformOrder = async (user, body) => {
    const platform = normalizeString(body.platform).toLowerCase();
    const order = body.order || {};
    const context = body.context || {};
    const items = Array.isArray(order.items) ? order.items : [];

    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }
    if (!items.length) {
        const err = new Error('order.items is required');
        err.statusCode = 400;
        throw err;
    }

    const results = [];
    for (const item of items) {
        const payload = {
            companyId: user.companyId,
            externalStoreId: order.externalStoreId || context.platform_store_id || context.external_store_id || context.storeId,
            shopId: order.shopId || context.shop_id || context.store_shop_id || context.external_store_id,
            openId: order.openId || context.platform_open_id || context.open_id || context.store_open_id || context.external_store_name,
            cipherId: order.cipherId || context.cipher || context.store_cipher || context.external_store_id,
            platformOrderId: order.orderId || order.orderNo || order.id,
            platformOrderItemId: item.orderItemId || item.id || null,
            quantitySold: Number(item.quantity || item.quantitySold || 1),
            itemId: item.itemId || item.platformItemId || item.productId,
            productId: item.productId || item.platformItemId || item.itemId,
            modelId: item.modelId || item.skuId,
            skuId: item.skuId || item.modelId,
            listingId: item.listingId || item.productId,
            warehouseId: item.warehouseId || order.warehouseId,
            locationId: item.locationId || order.locationId,
        };

        const result = await platformOrderDeductionsService.packFromOrderNotification(platform, payload, user);
        results.push({ itemId: payload.platformOrderItemId || payload.itemId || payload.skuId, result });
    }

    return { count: results.length, results };
};


const addFilter = (filters, field, value) => {
    const normalized = normalizeString(value);
    if (normalized) filters.push({ [field]: normalized });
};

const findPlatformMappingForOrderItem = async (user, { platform, context = {}, item = {}, transaction = null }) => {
    const { PlatformStore, PlatformSkuMapping } = require('../../models');
    const companyId = resolveCompanyId(user);
    const normalizedPlatform = normalizeString(platform).toLowerCase();
    const storeFilters = [];

    addFilter(storeFilters, 'external_store_id', context.platform_store_id || context.external_store_id || context.storeId);
    addFilter(storeFilters, 'store_shop_id', context.shop_id || context.store_shop_id);
    if (normalizedPlatform === 'shopee') addFilter(storeFilters, 'external_store_id', context.shop_id || context.external_store_id);
    addFilter(storeFilters, 'store_open_id', context.platform_open_id || context.open_id || context.store_open_id || context.external_store_name);
    addFilter(storeFilters, 'store_cipher', context.cipher || context.store_cipher || context.external_store_id);

    const store = await PlatformStore.findOne({
        where: {
            company_id: companyId,
            platform: normalizedPlatform,
            is_active: true,
            ...(storeFilters.length ? { [Op.or]: storeFilters } : {}),
        },
        transaction,
    });
    if (!store) {
        const err = new Error('Platform store not found for selected order');
        err.statusCode = 404;
        throw err;
    }

    const mappingFilters = [];
    if (normalizedPlatform === 'shopee') {
        const itemId = normalizeString(item.itemId || item.platformItemId || item.productId);
        const modelId = normalizeString(item.modelId || item.skuId);
        if (itemId) {
            mappingFilters.push({
                [Op.or]: [
                    { platform_item_id: itemId },
                    { platform_product_id: itemId },
                    { platform_listing_id: itemId },
                ],
            });
        }
        if (modelId) {
            mappingFilters.push({
                [Op.or]: [
                    { platform_model_id: modelId },
                    { platform_sku_id: modelId },
                ],
            });
        }
    } else {
        addFilter(mappingFilters, 'platform_product_id', item.productId || item.platformItemId || item.itemId);
        addFilter(mappingFilters, 'platform_item_id', item.itemId || item.platformItemId);
        addFilter(mappingFilters, 'platform_sku_id', item.skuId || item.modelId);
        addFilter(mappingFilters, 'platform_model_id', item.modelId || item.skuId);
        addFilter(mappingFilters, 'platform_listing_id', item.listingId || item.productId);
        addFilter(mappingFilters, 'platform_warehouse_id', item.warehouseId);
        addFilter(mappingFilters, 'platform_location_id', item.locationId);
    }

    if (!mappingFilters.length) {
        const err = new Error('Platform item identifiers are required to change SKU mapping');
        err.statusCode = 400;
        throw err;
    }

    const mappings = await PlatformSkuMapping.findAll({
        where: {
            company_id: companyId,
            platform_store_id: store.id,
            is_active: true,
            deleted_at: null,
            [Op.and]: mappingFilters,
        },
        limit: 2,
        lock: transaction ? transaction.LOCK.UPDATE : undefined,
        transaction,
    });

    if (!mappings.length) {
        const err = new Error('Platform SKU mapping not found for selected order item');
        err.statusCode = 404;
        throw err;
    }
    if (mappings.length > 1) {
        const err = new Error('Multiple mappings matched this order item. Please sync mapping first.');
        err.statusCode = 409;
        throw err;
    }
    return mappings[0];
};

const releaseReservedForMapping = async ({ user, mapping, quantity, transaction }) => {
    const { CombineSkuItem, SkuWarehouseStock } = require('../../models');
    const warehouseId = mapping.fulfillment_warehouse_id;
    if (!warehouseId || quantity <= 0) return [];
    const affected = [];

    if (mapping.merchant_sku_id) {
        const stock = await SkuWarehouseStock.findOne({
            where: { company_id: user.companyId, merchant_sku_id: mapping.merchant_sku_id, warehouse_id: warehouseId },
            lock: transaction.LOCK.UPDATE,
            transaction,
        });
        if (stock) {
            await stock.update({ qty_reserved: Math.max(0, Number(stock.qty_reserved || 0) - quantity) }, { transaction });
            affected.push(mapping.merchant_sku_id);
        }
        return affected;
    }

    if (mapping.combine_sku_id) {
        const items = await CombineSkuItem.findAll({
            where: { company_id: user.companyId, combine_sku_id: mapping.combine_sku_id },
            attributes: ['merchant_sku_id', 'quantity'],
            transaction,
        });
        for (const item of items) {
            const releaseQty = Number(item.quantity || 0) * quantity;
            const stock = await SkuWarehouseStock.findOne({
                where: { company_id: user.companyId, merchant_sku_id: item.merchant_sku_id, warehouse_id: warehouseId },
                lock: transaction.LOCK.UPDATE,
                transaction,
            });
            if (stock) {
                await stock.update({ qty_reserved: Math.max(0, Number(stock.qty_reserved || 0) - releaseQty) }, { transaction });
                affected.push(item.merchant_sku_id);
            }
        }
    }

    return affected;
};

const changePlatformOrderSku = async (user, body) => {
    const { MerchantSku, OrderSaleLine } = require('../../models');
    const companyId = resolveCompanyId(user);
    const platform = normalizeString(body.platform).toLowerCase();
    const order = body.order || {};
    const item = body.item || {};
    const merchantSkuId = Number(body.merchantSkuId || item.merchantSkuId);
    const warehouseId = Number(body.warehouseId || item.warehouseId);
    const quantitySold = toPositiveInt(item.quantity || body.quantitySold || 1, 'quantitySold');
    const platformOrderId = normalizeString(order.orderId || order.orderNo || order.id || body.platformOrderId);
    const platformOrderItemId = normalizeString(item.orderItemId || item.id || body.platformOrderItemId) || null;

    if (!['shopee', 'tiktok'].includes(platform)) {
        const err = new Error('platform must be shopee or tiktok');
        err.statusCode = 400;
        throw err;
    }
    if (!platformOrderId) {
        const err = new Error('platformOrderId is required');
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isInteger(merchantSkuId) || merchantSkuId <= 0 || !Number.isInteger(warehouseId) || warehouseId <= 0) {
        const err = new Error('merchantSkuId and warehouseId are required');
        err.statusCode = 400;
        throw err;
    }

    const merchantSku = await MerchantSku.findOne({ where: { id: merchantSkuId, company_id: companyId, deleted_at: null, status: 'active' } });
    if (!merchantSku) {
        const err = new Error('Selected merchant SKU not found');
        err.statusCode = 404;
        throw err;
    }

    let mappingId;
    await sequelize.transaction(async (transaction) => {
        const mapping = await findPlatformMappingForOrderItem(user, { platform, context: body.context || order.storeContext || {}, item, transaction });
        mappingId = mapping.id;

        const line = await OrderSaleLine.findOne({
            where: {
                platform_sku_mapping_id: mapping.id,
                platform_order_id: platformOrderId,
                platform_order_item_id: platformOrderItemId,
                deducted: false,
            },
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        if (line) {
            await releaseReservedForMapping({ user, mapping, quantity: Number(line.quantity_sold || quantitySold), transaction });
            await line.destroy({ transaction });
        }

        await mapping.update({
            merchant_sku_id: merchantSkuId,
            combine_sku_id: null,
            fulfillment_warehouse_id: warehouseId,
            sync_status: 'out_of_sync',
            sync_error: null,
        }, { transaction });
    });

    const reserved = await platformOrderDeductionsService.deductFromOrderNotification(platform, {
        companyId,
        platformMappingId: mappingId,
        platformOrderId,
        platformOrderItemId,
        quantitySold,
    }, user);

    return {
        message: 'SKU mapping updated and stock locked for the selected SKU',
        merchantSkuId,
        warehouseId,
        reserved,
    };
};

module.exports = {
    getManualOrderDropdowns,
    searchWarehouseSkus,
    buildEasyParcelLoginUrl,
    exchangeEasyParcelAuthorizationCode,
    updateEasyParcelTokens,
    refreshEasyParcelAccountToken,
    getAfterShipConfigStatus,
    updateAfterShipApiKey,
    listAfterShipCouriers,
    listAfterShipShipperAccounts,
    getAfterShipRates,
    listAfterShipManualParcels,
    getEasyParcelRates,
    listManualOrders,
    getManualOrderDetail,
    createManualOrder,
    submitManualOrderToEasyParcel,
    submitManualOrderToAfterShip,
    refreshManualOrderShipmentStatus,
    refreshManualOrderAfterShipStatus,
    getEasyParcelShipmentDetails,
    getAfterShipLabelDetails,
    cancelManualOrderEasyParcel,
    cancelManualOrderAfterShip,
    createManualOrderAfterShipPickup,
    updateManualOrderCodSettlement,
    finalizePackedPlatformOrder,
    changePlatformOrderSku,
};
