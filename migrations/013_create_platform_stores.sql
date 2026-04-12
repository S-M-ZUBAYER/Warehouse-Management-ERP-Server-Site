-- ============================================================
-- Migration: 013_create_platform_stores.sql
-- Description: Platform store connections (Shopee / TikTok / Lazada) per company
-- ============================================================

CREATE TABLE IF NOT EXISTS `platform_stores` (
    `id`                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`          INT UNSIGNED     NOT NULL,

    -- Platform identity
    `platform`            ENUM('shopee','tiktok','lazada') NOT NULL,
    `store_name`          VARCHAR(255)     NOT NULL COMMENT 'Friendly display name',
    `external_store_id`   VARCHAR(100)     NOT NULL COMMENT 'Platform-assigned store/shop ID',
    `external_store_name` VARCHAR(255)     NULL DEFAULT NULL COMMENT 'Name as shown on platform',
    `region`              VARCHAR(10)      NULL DEFAULT NULL COMMENT 'e.g. MY, SG, TH, ID, PH',

    -- Auth tokens (stored encrypted in production — encrypt at app layer)
    `access_token`        TEXT             NULL DEFAULT NULL,
    `refresh_token`       TEXT             NULL DEFAULT NULL,
    `token_expires_at`    DATETIME         NULL DEFAULT NULL,

    -- Webhook
    `webhook_secret`      VARCHAR(255)     NULL DEFAULT NULL
        COMMENT 'Used to verify incoming webhooks from this platform store',

    -- Fulfillment defaults
    `default_warehouse_id` INT UNSIGNED    NULL DEFAULT NULL
        COMMENT 'Default warehouse to fulfil orders from this store',

    `is_active`           TINYINT(1)       NOT NULL DEFAULT 1,

    `created_by`          INT UNSIGNED     NULL DEFAULT NULL,
    `created_at`          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`          DATETIME         NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    -- One store connection per platform per company
    UNIQUE KEY `uq_platform_stores` (`company_id`, `platform`, `external_store_id`),

    KEY `idx_ps_company`            (`company_id`),
    KEY `idx_ps_platform`           (`platform`),
    KEY `idx_ps_active`             (`company_id`, `is_active`),
    KEY `idx_ps_deleted`            (`deleted_at`),

    CONSTRAINT `fk_ps_company`
        FOREIGN KEY (`company_id`)          REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ps_default_warehouse`
        FOREIGN KEY (`default_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Connected platform store accounts (Shopee/TikTok/Lazada) per company';