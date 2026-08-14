-- ============================================================
-- Migration: 037_add_platform_order_sku_adjustment_fields.sql
-- Description: Extend platform order item SKU overrides so the
--              same table can store exchange and add SKU rows.
-- ============================================================

ALTER TABLE `platform_order_item_sku_overrides`
    ADD COLUMN IF NOT EXISTS `adjustment_type` ENUM('exchange', 'add') NOT NULL DEFAULT 'exchange' AFTER `platform_order_item_id`,
    ADD COLUMN IF NOT EXISTS `source_tab` VARCHAR(60) NULL DEFAULT NULL AFTER `quantity`,
    ADD COLUMN IF NOT EXISTS `display_section` VARCHAR(60) NULL DEFAULT NULL AFTER `source_tab`;

ALTER TABLE `platform_order_item_sku_overrides`
    MODIFY COLUMN `original_platform_mapping_id` INT UNSIGNED NULL;

ALTER TABLE `platform_order_item_sku_overrides`
    MODIFY COLUMN `original_merchant_sku_id` INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN `original_combine_sku_id` INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN `replacement_merchant_sku_id` INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN `replacement_combine_sku_id` INT UNSIGNED NULL DEFAULT NULL;

ALTER TABLE `platform_order_item_sku_overrides`
    ADD INDEX IF NOT EXISTS `idx_pois_adjustment_type` (`adjustment_type`),
    ADD INDEX IF NOT EXISTS `idx_pois_display_section` (`display_section`);
