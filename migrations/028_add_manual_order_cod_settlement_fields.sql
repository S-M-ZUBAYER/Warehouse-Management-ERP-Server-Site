-- ============================================================
-- Migration: 028_add_manual_order_cod_settlement_fields.sql
-- Description: Adds internal COD payout/reconciliation fields for Manual Orders.
-- Note: EasyParcel OpenAPI does not expose COD payout settlement status,
--       so these fields are for ERP/admin reconciliation after checking
--       EasyParcel dashboard/report.
-- ============================================================

ALTER TABLE `manual_orders`
    ADD COLUMN IF NOT EXISTS `cod_settlement_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `cod_fee`,
    ADD COLUMN IF NOT EXISTS `cod_paid_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `cod_settlement_amount`,
    ADD COLUMN IF NOT EXISTS `cod_paid_at` DATETIME NULL AFTER `cod_paid_amount`,
    ADD COLUMN IF NOT EXISTS `cod_payout_reference` VARCHAR(150) NULL AFTER `cod_paid_at`,
    ADD COLUMN IF NOT EXISTS `cod_settlement_note` TEXT NULL AFTER `cod_payout_reference`;

CREATE INDEX IF NOT EXISTS `idx_manual_orders_company_cod_status`
    ON `manual_orders` (`company_id`, `cod_status`);
