-- ============================================================
-- Migration: 004_create_product_tables.sql
-- Tables: merchant_skus, combine_skus, combine_sku_items
-- Run AFTER: 002_create_warehouses_table.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────
-- Table 1: merchant_skus (core internal SKU / Product List)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `merchant_skus` (
    `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`      INT UNSIGNED     NOT NULL,
    `warehouse_id`    INT UNSIGNED     DEFAULT NULL,
    `product_id`      INT UNSIGNED     DEFAULT NULL,
    `sku_name`        VARCHAR(100)     NOT NULL  COMMENT 'Unique SKU code e.g. WM-012',
    `sku_title`       VARCHAR(255)     NOT NULL  COMMENT 'Display product name',
    `gtin`            VARCHAR(50)      DEFAULT NULL,
    `product_details` TEXT             DEFAULT NULL,
    `weight`          DECIMAL(10,2)    DEFAULT NULL,
    `length`          DECIMAL(10,2)    DEFAULT NULL,
    `width`           DECIMAL(10,2)    DEFAULT NULL,
    `height`          DECIMAL(10,2)    DEFAULT NULL,
    `price`           DECIMAL(15,2)    DEFAULT NULL,
    `cost_price`      DECIMAL(15,2)    DEFAULT NULL,
    `image_url`       TEXT             DEFAULT NULL,
    `country`         VARCHAR(100)     DEFAULT NULL,
    `status`          ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_by`      INT UNSIGNED     DEFAULT NULL,
    `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`      DATETIME         DEFAULT NULL COMMENT 'Soft delete',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_merchant_skus_company_sku`     (`company_id`, `sku_name`),
    KEY        `idx_merchant_skus_company_status` (`company_id`, `status`),
    KEY        `idx_merchant_skus_warehouse`      (`company_id`, `warehouse_id`),
    KEY        `idx_merchant_skus_created`        (`company_id`, `created_at`),
    KEY        `idx_merchant_skus_updated`        (`company_id`, `updated_at`),
    FULLTEXT KEY `ft_merchant_skus_name_title`    (`sku_name`, `sku_title`),

    CONSTRAINT `fk_merchant_skus_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_merchant_skus_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Core merchant SKU catalog — one SKU per sellable unit';


-- ─────────────────────────────────────────────────────────────
-- Table 2: combine_skus (bundle products)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `combine_skus` (
    `id`               INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `company_id`       INT UNSIGNED   NOT NULL,
    `warehouse_id`     INT UNSIGNED   DEFAULT NULL,
    `combine_name`     VARCHAR(255)   NOT NULL,
    `combine_sku_code` VARCHAR(100)   NOT NULL,
    `gtin`             VARCHAR(50)    DEFAULT NULL,
    `description`      TEXT           DEFAULT NULL,
    `selling_price`    DECIMAL(15,2)  DEFAULT NULL,
    `cost_price`       DECIMAL(15,2)  DEFAULT NULL,
    `weight`           DECIMAL(10,2)  DEFAULT NULL,
    `length`           DECIMAL(10,2)  DEFAULT NULL,
    `width`            DECIMAL(10,2)  DEFAULT NULL,
    `height`           DECIMAL(10,2)  DEFAULT NULL,
    `image_url`        TEXT           DEFAULT NULL,
    `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_by`       INT UNSIGNED   DEFAULT NULL,
    `created_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`       DATETIME       DEFAULT NULL COMMENT 'Soft delete',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_combine_skus_company_code`  (`company_id`, `combine_sku_code`),
    KEY        `idx_combine_skus_company`      (`company_id`),
    KEY        `idx_combine_skus_warehouse`    (`company_id`, `warehouse_id`),
    KEY        `idx_combine_skus_created`      (`company_id`, `created_at`),
    KEY        `idx_combine_skus_updated`      (`company_id`, `updated_at`),

    CONSTRAINT `fk_combine_skus_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_combine_skus_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Bundle SKUs — multiple merchant SKUs combined into one sellable unit';


-- ─────────────────────────────────────────────────────────────
-- Table 3: combine_sku_items (junction)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `combine_sku_items` (
    `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`      INT UNSIGNED  NOT NULL,
    `combine_sku_id`  INT UNSIGNED  NOT NULL,
    `merchant_sku_id` INT UNSIGNED  NOT NULL,
    `quantity`        INT UNSIGNED  NOT NULL DEFAULT 1,
    `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_combine_sku_items`          (`combine_sku_id`, `merchant_sku_id`),
    KEY        `idx_combine_items_merchant_sku`(`company_id`, `merchant_sku_id`),

    CONSTRAINT `fk_combine_items_combine_sku`
        FOREIGN KEY (`combine_sku_id`)  REFERENCES `combine_skus`  (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_combine_items_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Which merchant SKUs and quantities form a combine SKU';

SET FOREIGN_KEY_CHECKS = 1;

-- Verify
SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('merchant_skus','combine_skus','combine_sku_items')
ORDER BY CREATE_TIME;