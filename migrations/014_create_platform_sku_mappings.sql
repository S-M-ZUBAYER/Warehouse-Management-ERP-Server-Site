-- -- ============================================================
-- -- Migration: 014_create_platform_sku_mappings.sql
-- -- Description: Maps internal merchant/combine SKUs to external platform listings.
-- --              This is the bridge table Java reads to know which internal SKU
-- --              corresponds to which platform product listing.
-- -- ============================================================

-- CREATE TABLE IF NOT EXISTS `platform_sku_mappings` (
--     `id`                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
--     `company_id`            INT UNSIGNED     NOT NULL,
--     `platform_store_id`     INT UNSIGNED     NOT NULL,

--     -- Internal SKU reference — exactly one must be non-null (enforced by CHECK)
--     `merchant_sku_id`       INT UNSIGNED     NULL DEFAULT NULL,
--     `combine_sku_id`        INT UNSIGNED     NULL DEFAULT NULL,

--     -- Fulfillment warehouse for this specific mapping
--     `fulfillment_warehouse_id` INT UNSIGNED  NULL DEFAULT NULL,

--     -- Platform-side identifiers (written back by Java after product push)
--     `platform_sku_id`       VARCHAR(100)     NULL DEFAULT NULL COMMENT 'SKU ID on the platform',
--     `platform_listing_id`   VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Product/listing ID on the platform',
--     `platform_model_id`     VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Model/variant ID (Shopee)',

--     -- Sync tracking
--     `last_synced_at`        DATETIME         NULL DEFAULT NULL,
--     `sync_status`           ENUM('pending','synced','failed','out_of_sync')
--                             NOT NULL DEFAULT 'pending',
--     `sync_error`            TEXT             NULL DEFAULT NULL,

--     `is_active`             TINYINT(1)       NOT NULL DEFAULT 1,
--     `created_by`            INT UNSIGNED     NULL DEFAULT NULL,

--     `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     `deleted_at`            DATETIME         NULL DEFAULT NULL,

--     PRIMARY KEY (`id`),

--     -- One internal SKU can be mapped to a platform store only once
--     UNIQUE KEY `uq_psm_store_merchant` (`platform_store_id`, `merchant_sku_id`),
--     UNIQUE KEY `uq_psm_store_combine`  (`platform_store_id`, `combine_sku_id`),

--     -- Fast lookup by platform listing ID (used in webhook handler)
--     UNIQUE KEY `uq_psm_listing`        (`platform_store_id`, `platform_listing_id`, `platform_sku_id`),

--     KEY `idx_psm_company`              (`company_id`),
--     KEY `idx_psm_platform_store`       (`platform_store_id`),
--     KEY `idx_psm_merchant_sku`         (`merchant_sku_id`),
--     KEY `idx_psm_combine_sku`          (`combine_sku_id`),
--     KEY `idx_psm_active`               (`company_id`, `is_active`),
--     KEY `idx_psm_sync_status`          (`sync_status`),
--     KEY `idx_psm_deleted`              (`deleted_at`),

--     CONSTRAINT `fk_psm_company`
--         FOREIGN KEY (`company_id`)             REFERENCES `companies` (`id`) ON DELETE CASCADE,
--     CONSTRAINT `fk_psm_platform_store`
--         FOREIGN KEY (`platform_store_id`)      REFERENCES `platform_stores` (`id`) ON DELETE CASCADE,
--     CONSTRAINT `fk_psm_merchant_sku`
--         FOREIGN KEY (`merchant_sku_id`)        REFERENCES `merchant_skus` (`id`) ON DELETE CASCADE,
--     CONSTRAINT `fk_psm_combine_sku`
--         FOREIGN KEY (`combine_sku_id`)         REFERENCES `combine_skus` (`id`) ON DELETE CASCADE,
--     CONSTRAINT `fk_psm_fulfillment_warehouse`
--         FOREIGN KEY (`fulfillment_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,

--     -- Exactly one of merchant_sku_id or combine_sku_id must be set
--     CONSTRAINT `chk_psm_sku_xor`
--         CHECK (
--             (`merchant_sku_id` IS NOT NULL AND `combine_sku_id` IS NULL) OR
--             (`merchant_sku_id` IS NULL     AND `combine_sku_id` IS NOT NULL)
--         )

-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
--   COMMENT='Bridge table: maps internal SKUs to platform listing IDs — read by Java for sync';



-- ============================================================
-- Migration: 014_create_platform_sku_mappings.sql
-- Description: Maps internal merchant/combine SKUs to external platform listings.
--              This is the bridge table Java reads to know which internal SKU
--              corresponds to which platform product listing.
-- ============================================================

CREATE TABLE IF NOT EXISTS `platform_sku_mappings` (
    `id`                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`            INT UNSIGNED     NOT NULL,
    `platform_store_id`     INT UNSIGNED     NOT NULL,

    -- Internal SKU reference — exactly one must be non-null (enforced by CHECK)
    `merchant_sku_id`       INT UNSIGNED     NULL DEFAULT NULL,
    `combine_sku_id`        INT UNSIGNED     NULL DEFAULT NULL,

    -- Fulfillment warehouse for this specific mapping
    `fulfillment_warehouse_id` INT UNSIGNED  NULL DEFAULT NULL,

    -- Platform-side identifiers (written back by Java after product push)
    `platform_sku_id`       VARCHAR(100)     NULL DEFAULT NULL COMMENT 'SKU ID on the platform',
    `platform_listing_id`   VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Product/listing ID on the platform',
    `platform_model_id`     VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Model/variant ID (Shopee)',

    -- Optional extended platform-side identifiers
    `platform_shop_id`      VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Shop/seller ID on the platform (e.g. TikTok shop_id)',
    `platform_open_id`      VARCHAR(100)     NULL DEFAULT NULL COMMENT 'OAuth open_id for the seller account',
    `platform_cipher_id`    VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Encrypted/cipher ID used by some platforms (e.g. TikTok)',
    `platform_product_id`   VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Product-level ID on the platform',
    `platform_warehouse_id` VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Warehouse ID on the platform side',
    `platform_item_id`      VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Item-level ID (Lazada/Shopee item_id)',
    `platform_location_id`  VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Location/fulfillment center ID on the platform',

    -- Sync tracking
    `last_synced_at`        DATETIME         NULL DEFAULT NULL,
    `sync_status`           ENUM('pending','synced','failed','out_of_sync')
                            NOT NULL DEFAULT 'pending',
    `sync_error`            TEXT             NULL DEFAULT NULL,

    `is_active`             TINYINT(1)       NOT NULL DEFAULT 1,
    `created_by`            INT UNSIGNED     NULL DEFAULT NULL,

    `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`            DATETIME         NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    -- One internal SKU can be mapped to a platform store only once
    UNIQUE KEY `uq_psm_store_merchant` (`platform_store_id`, `merchant_sku_id`),
    UNIQUE KEY `uq_psm_store_combine`  (`platform_store_id`, `combine_sku_id`),

    -- Fast lookup by platform listing ID (used in webhook handler)
    UNIQUE KEY `uq_psm_listing`        (`platform_store_id`, `platform_listing_id`, `platform_sku_id`),

    KEY `idx_psm_company`              (`company_id`),
    KEY `idx_psm_platform_store`       (`platform_store_id`),
    KEY `idx_psm_merchant_sku`         (`merchant_sku_id`),
    KEY `idx_psm_combine_sku`          (`combine_sku_id`),
    KEY `idx_psm_active`               (`company_id`, `is_active`),
    KEY `idx_psm_sync_status`          (`sync_status`),
    KEY `idx_psm_deleted`              (`deleted_at`),

    CONSTRAINT `fk_psm_company`
        FOREIGN KEY (`company_id`)             REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_psm_platform_store`
        FOREIGN KEY (`platform_store_id`)      REFERENCES `platform_stores` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_psm_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`)        REFERENCES `merchant_skus` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_psm_combine_sku`
        FOREIGN KEY (`combine_sku_id`)         REFERENCES `combine_skus` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_psm_fulfillment_warehouse`
        FOREIGN KEY (`fulfillment_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,

    -- Exactly one of merchant_sku_id or combine_sku_id must be set
    CONSTRAINT `chk_psm_sku_xor`
        CHECK (
            (`merchant_sku_id` IS NOT NULL AND `combine_sku_id` IS NULL) OR
            (`merchant_sku_id` IS NULL     AND `combine_sku_id` IS NOT NULL)
        )

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bridge table: maps internal SKUs to platform listing IDs — read by Java for sync';