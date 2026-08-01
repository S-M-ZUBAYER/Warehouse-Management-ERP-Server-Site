-- ============================================================
-- Migration: 034_add_combine_sku_to_order_lines.sql
-- Description: Allows manual, platform manual, and outbound lines to reference either a merchant SKU or a combine SKU.
-- ============================================================

ALTER TABLE `manual_order_items`
    MODIFY `merchant_sku_id` INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS `combine_sku_id` INT UNSIGNED NULL AFTER `merchant_sku_id`,
    ADD KEY IF NOT EXISTS `idx_moi_combine_sku` (`combine_sku_id`),
    ADD CONSTRAINT `fk_moi_combine_sku`
        FOREIGN KEY (`combine_sku_id`) REFERENCES `combine_skus` (`id`) ON DELETE RESTRICT;

ALTER TABLE `platform_manual_order_items`
    MODIFY `merchant_sku_id` INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS `combine_sku_id` INT UNSIGNED NULL AFTER `merchant_sku_id`,
    ADD KEY IF NOT EXISTS `idx_pmoi_combine_sku` (`combine_sku_id`),
    ADD CONSTRAINT `fk_pmoi_combine_sku`
        FOREIGN KEY (`combine_sku_id`) REFERENCES `combine_skus` (`id`) ON DELETE RESTRICT;

ALTER TABLE `outbound_order_lines`
    MODIFY `merchant_sku_id` INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS `combine_sku_id` INT UNSIGNED NULL AFTER `merchant_sku_id`,
    ADD UNIQUE KEY IF NOT EXISTS `uq_outbound_order_lines_combine` (`outbound_order_id`, `combine_sku_id`),
    ADD KEY IF NOT EXISTS `idx_iol_combine_sku` (`combine_sku_id`),
    ADD CONSTRAINT `fk_iol_combine_sku`
        FOREIGN KEY (`combine_sku_id`) REFERENCES `combine_skus` (`id`) ON DELETE RESTRICT;
