ALTER TABLE `platform_stores`
  ADD COLUMN IF NOT EXISTS `auto_order_accept_days` VARCHAR(50) NOT NULL DEFAULT '0,1,2,3,4,5,6' AFTER `auto_order_accept`;
