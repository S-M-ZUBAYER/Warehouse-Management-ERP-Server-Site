-- ============================================================
-- Migration: 035_add_combine_sku_to_platform_order_item_sku_overrides.sql
-- Description: Allow order item SKU overrides to use a replacement
--              Combine SKU as an alternative to Merchant SKU.
-- ============================================================

ALTER TABLE `platform_order_item_sku_overrides`
    MODIFY COLUMN `replacement_merchant_sku_id` INT UNSIGNED NULL DEFAULT NULL,
    ADD COLUMN `replacement_combine_sku_id` INT UNSIGNED NULL DEFAULT NULL AFTER `replacement_merchant_sku_id`;

ALTER TABLE `platform_order_item_sku_overrides`
    ADD KEY `idx_pois_replacement_combine_sku` (`replacement_combine_sku_id`),
    ADD CONSTRAINT `fk_pois_replacement_combine_sku`
        FOREIGN KEY (`replacement_combine_sku_id`) REFERENCES `combine_skus` (`id`) ON DELETE RESTRICT,
    ADD CONSTRAINT `chk_pois_one_replacement_sku`
        CHECK (
            (`replacement_merchant_sku_id` IS NOT NULL AND `replacement_combine_sku_id` IS NULL)
            OR (`replacement_merchant_sku_id` IS NULL AND `replacement_combine_sku_id` IS NOT NULL)
        );
