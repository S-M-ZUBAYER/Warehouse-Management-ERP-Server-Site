-- -- ============================================================
-- -- Migration: 017_create_platform_products.sql
-- -- Stores products synced from Shopee and TikTok Shop.
-- -- Each parent product has multiple child SKU rows.
-- -- ============================================================
-- CREATE TABLE IF NOT EXISTS `platform_products` (
--     `id`                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
--     `company_id`            INT UNSIGNED  NOT NULL,
--     `platform_store_id`     INT UNSIGNED  NOT NULL,
--     `platform`              VARCHAR(32)   NOT NULL COMMENT 'shopee | tiktok | lazada',
--     `platform_product_id`   VARCHAR(128)  NOT NULL COMMENT 'Shopee item_id / TikTok product id',
--     `platform_sku_id`       VARCHAR(128)  NULL     COMMENT 'TikTok sku.id / Shopee model_id string',
--     `platform_model_id`     VARCHAR(128)  NULL     COMMENT 'Shopee model_id numeric',
--     `platform_location_id`  VARCHAR(64)   NULL     COMMENT 'Shopee location_id e.g. SGZ',
--     `platform_warehouse_id` VARCHAR(128)  NULL     COMMENT 'TikTok warehouseId',
--     `product_name`          VARCHAR(512)  NOT NULL,
--     `variation_name`        VARCHAR(255)  NULL,
--     `parent_sku`            VARCHAR(128)  NULL,
--     `seller_sku`            VARCHAR(128)  NULL     COMMENT 'SKU string shown to seller',
--     `image_url`             VARCHAR(1000) NULL,
--     `store_name`            VARCHAR(255)  NULL,
--     `platform_stock`        INT           NOT NULL DEFAULT 0,
--     `platform_price`        DECIMAL(12,2) NULL,
--     `currency`              VARCHAR(10)   NULL,
--     `is_mapped`             TINYINT(1)    NOT NULL DEFAULT 0,
--     `row_type`              ENUM('parent','child') NOT NULL DEFAULT 'child',
--     `synced_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     PRIMARY KEY (`id`),
--     UNIQUE KEY `uq_pp_sku` (`platform_store_id`, `platform_product_id`, `platform_sku_id`),
--     KEY `idx_pp_company`   (`company_id`),
--     KEY `idx_pp_store`     (`platform_store_id`),
--     KEY `idx_pp_mapped`    (`company_id`, `is_mapped`),
--     KEY `idx_pp_row_type`  (`platform_store_id`, `row_type`),
--     CONSTRAINT `fk_pp_store` FOREIGN KEY (`platform_store_id`) REFERENCES `platform_stores`(`id`) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Migration: 017_create_platform_products.sql
-- Stores products synced from Shopee and TikTok Shop.
-- Each parent product has multiple child SKU rows.
-- ============================================================
CREATE TABLE IF NOT EXISTS `platform_products` (
    `id`                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`            INT UNSIGNED  NOT NULL,
    `platform_store_id`     INT UNSIGNED  NOT NULL,
    `platform`              VARCHAR(32)   NOT NULL COMMENT 'shopee | tiktok | lazada',
    `platform_product_id`   VARCHAR(128)  NOT NULL COMMENT 'Shopee item_id / TikTok product id',
    `platform_sku_id`       VARCHAR(128)  NULL     COMMENT 'TikTok sku.id / Shopee model_id string',
    `platform_model_id`     VARCHAR(128)  NULL     COMMENT 'Shopee model_id numeric',
    `platform_location_id`  VARCHAR(64)   NULL     COMMENT 'Shopee location_id e.g. SGZ',
    `platform_warehouse_id` VARCHAR(128)  NULL     COMMENT 'TikTok warehouseId',
    `product_name`          VARCHAR(512)  NOT NULL,
    `variation_name`        VARCHAR(255)  NULL,
    `parent_sku`            VARCHAR(128)  NULL,
    `seller_sku`            VARCHAR(128)  NULL     COMMENT 'SKU string shown to seller',
    `image_url`             VARCHAR(1000) NULL,
    `store_name`            VARCHAR(255)  NULL,
    `platform_stock`        INT           NOT NULL DEFAULT 0,
    `platform_price`        DECIMAL(12,2) NULL,
    `currency`              VARCHAR(10)   NULL,
    `product_status`        VARCHAR(64)   NULL     COMMENT 'Platform status e.g. ACTIVATE/NORMAL',
    `has_variants`          TINYINT(1)    NOT NULL DEFAULT 0,
    `weight`                DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Weight in kg from platform product/SKU',
    `length`                DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Package length in cm from platform product/SKU',
    `width`                 DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Package width in cm from platform product/SKU',
    `height`                DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Package height in cm from platform product/SKU',
    `is_mapped`             TINYINT(1)    NOT NULL DEFAULT 0,
    `row_type`              ENUM('parent','child') NOT NULL DEFAULT 'child',
    `synced_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_pp_sku` (`platform_store_id`, `platform_product_id`, `platform_sku_id`),
    KEY `idx_pp_company`   (`company_id`),
    KEY `idx_pp_store`     (`platform_store_id`),
    KEY `idx_pp_mapped`    (`company_id`, `is_mapped`),
    KEY `idx_pp_row_type`  (`platform_store_id`, `row_type`),
    KEY `idx_pp_company_status` (`company_id`, `product_status`),
    CONSTRAINT `fk_pp_store` FOREIGN KEY (`platform_store_id`) REFERENCES `platform_stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;