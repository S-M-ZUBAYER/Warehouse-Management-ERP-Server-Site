-- ============================================================
-- Migration: 007_create_combine_skus.sql
-- Description: Bundle/combined SKU table — groups multiple merchant SKUs into one virtual product
-- ============================================================

CREATE TABLE IF NOT EXISTS `combine_skus` (
    `id`                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`        INT UNSIGNED     NOT NULL,
    `warehouse_id`      INT UNSIGNED     NULL DEFAULT NULL,

    -- Identity
    `combine_name`      VARCHAR(255)     NOT NULL COMMENT 'Display name for the bundle',
    `combine_sku_code`  VARCHAR(100)     NOT NULL COMMENT 'Unique bundle SKU code e.g. COMBO-001',
    `gtin`              VARCHAR(50)      NULL DEFAULT NULL,
    `description`       TEXT             NULL DEFAULT NULL,

    -- Pricing
    `selling_price`     DECIMAL(15,2)    NULL DEFAULT NULL,
    `cost_price`        DECIMAL(15,2)    NULL DEFAULT NULL,

    -- Physical (for shipping estimation)
    `weight`            DECIMAL(10,2)    NULL DEFAULT NULL,
    `length`            DECIMAL(10,2)    NULL DEFAULT NULL,
    `width`             DECIMAL(10,2)    NULL DEFAULT NULL,
    `height`            DECIMAL(10,2)    NULL DEFAULT NULL,

    -- Media
    `image_url`         TEXT             NULL DEFAULT NULL,

    -- Stock (computed — MIN(child_qty / child_ratio), updated by worker)
    `computed_quantity` INT UNSIGNED     NOT NULL DEFAULT 0
        COMMENT 'Auto-computed from child SKU stock: MIN(FLOOR(qty_on_hand / quantity))',

    -- Metadata
    `status`            ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_by`        INT UNSIGNED     NULL DEFAULT NULL,

    -- Timestamps
    `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`        DATETIME         NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    UNIQUE KEY `uq_combine_skus_company_code` (`company_id`, `combine_sku_code`),

    KEY `idx_combine_skus_company`    (`company_id`),
    KEY `idx_combine_skus_warehouse`  (`company_id`, `warehouse_id`),
    KEY `idx_combine_skus_created`    (`company_id`, `created_at`),
    KEY `idx_combine_skus_deleted`    (`deleted_at`),

    CONSTRAINT `fk_combine_skus_company`
        FOREIGN KEY (`company_id`)   REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_combine_skus_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Virtual bundle SKU composed of one or more merchant SKUs';