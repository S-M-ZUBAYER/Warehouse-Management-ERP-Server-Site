-- ============================================================
-- Migration: 008_create_combine_sku_items.sql
-- Description: Junction table linking combine SKUs to their component merchant SKUs with quantity ratios
-- ============================================================

CREATE TABLE IF NOT EXISTS `combine_sku_items` (
    `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`      INT UNSIGNED     NOT NULL,
    `combine_sku_id`  INT UNSIGNED     NOT NULL,
    `merchant_sku_id` INT UNSIGNED     NOT NULL,

    -- How many units of this merchant SKU make up 1 unit of the combine SKU
    `quantity`        INT UNSIGNED     NOT NULL DEFAULT 1
        COMMENT 'Units of this merchant SKU required per 1 unit of the bundle',

    `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- A merchant SKU can appear only once per combine SKU
    UNIQUE KEY `uq_combine_sku_items` (`combine_sku_id`, `merchant_sku_id`),

    KEY `idx_combine_items_company`      (`company_id`),
    KEY `idx_combine_items_merchant_sku` (`company_id`, `merchant_sku_id`),
    KEY `idx_combine_items_combine_sku`  (`combine_sku_id`),

    CONSTRAINT `fk_csi_company`
        FOREIGN KEY (`company_id`)      REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_csi_combine_sku`
        FOREIGN KEY (`combine_sku_id`)  REFERENCES `combine_skus` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_csi_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE RESTRICT
        COMMENT 'Prevent deleting a merchant SKU that is still part of a bundle'

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Component items within a combine SKU — defines the bundle composition';