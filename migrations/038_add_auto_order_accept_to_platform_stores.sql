ALTER TABLE `platform_stores`
  ADD COLUMN IF NOT EXISTS `auto_order_accept` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`;
