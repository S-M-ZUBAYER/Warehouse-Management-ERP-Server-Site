-- ============================================================
-- Migration: 016_add_min_stock_to_sku_warehouse_stock.sql
-- Description: Adds min_stock alert threshold column to sku_warehouse_stock.
--              When qty_on_hand <= min_stock  → Low Stock
--              When qty_on_hand = 0           → Out of Stock
--              When min_stock IS NULL         → No Alert configured
-- ============================================================

ALTER TABLE `sku_warehouse_stock`
    ADD COLUMN `min_stock` INT UNSIGNED NULL DEFAULT NULL
        COMMENT 'Minimum stock alert threshold. NULL = no alert set. Low Stock when qty_on_hand <= min_stock.'
    AFTER `qty_inbound`;

-- Index for fast "find all records where qty is at or below threshold"
ALTER TABLE `sku_warehouse_stock`
    ADD KEY `idx_sws_min_stock` (`company_id`, `min_stock`);
