-- ============================================================
-- Migration: 006_create_merchant_skus.sql
-- Description: Merchant SKU master table (product catalogue per company/warehouse)
-- ============================================================

CREATE TABLE IF NOT EXISTS `merchant_skus` (
    `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`      INT UNSIGNED     NOT NULL,
    `warehouse_id`    INT UNSIGNED     NULL DEFAULT NULL,
    `product_id`      INT UNSIGNED     NULL DEFAULT NULL,

    -- Identity
    `sku_name`        VARCHAR(100)     NOT NULL COMMENT 'Unique SKU code e.g. WM-012',
    `sku_title`       VARCHAR(255)     NOT NULL COMMENT 'Display name',
    `gtin`            VARCHAR(50)      NULL DEFAULT NULL COMMENT 'Global Trade Item Number (barcode)',
    `product_details` TEXT             NULL DEFAULT NULL,

    -- Physical dimensions
    `weight`          DECIMAL(10,2)    NULL DEFAULT NULL COMMENT 'Weight in kg',
    `length`          DECIMAL(10,2)    NULL DEFAULT NULL COMMENT 'Length in cm',
    `width`           DECIMAL(10,2)    NULL DEFAULT NULL COMMENT 'Width in cm',
    `height`          DECIMAL(10,2)    NULL DEFAULT NULL COMMENT 'Height in cm',

    -- Pricing
    `price`           DECIMAL(15,2)    NULL DEFAULT NULL COMMENT 'Selling price',
    `cost_price`      DECIMAL(15,2)    NULL DEFAULT NULL COMMENT 'Purchase/cost price',

    -- Media
    `image_url`       TEXT             NULL DEFAULT NULL,

    -- Metadata
    `country`         VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Country of origin',
    `status`          ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_by`      INT UNSIGNED     NULL DEFAULT NULL,

    -- Timestamps
    `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`      DATETIME         NULL DEFAULT NULL COMMENT 'Soft delete timestamp',

    PRIMARY KEY (`id`),

    -- Unique: one SKU code per company
    UNIQUE KEY `uq_merchant_skus_company_sku` (`company_id`, `sku_name`),

    -- Performance indexes
    KEY `idx_merchant_skus_company_status`  (`company_id`, `status`),
    KEY `idx_merchant_skus_warehouse`       (`company_id`, `warehouse_id`),
    KEY `idx_merchant_skus_created`         (`company_id`, `created_at`),
    KEY `idx_merchant_skus_deleted`         (`deleted_at`),

    -- Full-text search on name + title
    FULLTEXT KEY `ft_merchant_skus_name_title` (`sku_name`, `sku_title`),

    -- Foreign keys
    CONSTRAINT `fk_merchant_skus_company`
        FOREIGN KEY (`company_id`)   REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_merchant_skus_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master product/SKU catalogue — one record per unique product per company';