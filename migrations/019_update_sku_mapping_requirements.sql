-- ============================================================
-- Migration: 019_update_sku_mapping_requirements.sql
-- Description: Adds missing SKU Mapping fields required for platform sync.
-- Safe to run after 017_create_platform_products.sql.
-- ============================================================

ALTER TABLE `platform_products`
    ADD COLUMN `product_status` VARCHAR(64) NULL COMMENT 'Platform status e.g. ACTIVATE/NORMAL' AFTER `currency`,
    ADD COLUMN `has_variants` TINYINT(1) NOT NULL DEFAULT 0 AFTER `product_status`,
    ADD COLUMN `weight` DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Weight in kg from platform product/SKU' AFTER `has_variants`,
    ADD COLUMN `length` DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Package length in cm from platform product/SKU' AFTER `weight`,
    ADD COLUMN `width` DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Package width in cm from platform product/SKU' AFTER `length`,
    ADD COLUMN `height` DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Package height in cm from platform product/SKU' AFTER `width`;

CREATE INDEX `idx_pp_company_status` ON `platform_products` (`company_id`, `product_status`);
