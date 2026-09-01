-- ============================================================
-- Migration: 047_create_manual_order_shipping_wallet.sql
-- Description: Adds company MYR shipping wallet and ledger for paid Manual Order courier bookings.
-- ============================================================

CREATE TABLE IF NOT EXISTS `company_shipping_wallets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id` INT UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'MYR',
    `balance_myr` DECIMAL(15,2) NOT NULL DEFAULT 0,
    `created_by` INT UNSIGNED NULL,
    `updated_by` INT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_company_shipping_wallets_company` (`company_id`),
    CONSTRAINT `fk_company_shipping_wallets_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_shipping_wallet_ledger` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id` INT UNSIGNED NOT NULL,
    `wallet_id` BIGINT UNSIGNED NOT NULL,
    `manual_order_id` BIGINT UNSIGNED NULL,
    `type` VARCHAR(40) NOT NULL,
    `amount_myr` DECIMAL(15,2) NOT NULL,
    `balance_before_myr` DECIMAL(15,2) NOT NULL,
    `balance_after_myr` DECIMAL(15,2) NOT NULL,
    `original_amount` DECIMAL(15,2) NULL,
    `original_currency` VARCHAR(10) NULL,
    `fx_rate_to_myr` DECIMAL(18,8) NULL,
    `provider` VARCHAR(40) NULL,
    `reference` VARCHAR(150) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'succeeded',
    `metadata` JSON NULL,
    `created_by` INT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_cswl_company_created` (`company_id`, `created_at`),
    KEY `idx_cswl_wallet_created` (`wallet_id`, `created_at`),
    KEY `idx_cswl_manual_order` (`manual_order_id`),
    KEY `idx_cswl_reference` (`reference`),
    KEY `idx_cswl_type_status` (`type`, `status`),
    CONSTRAINT `fk_cswl_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cswl_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `company_shipping_wallets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cswl_manual_order` FOREIGN KEY (`manual_order_id`) REFERENCES `manual_orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `manual_orders`
    ADD COLUMN IF NOT EXISTS `shipping_wallet_ledger_id` BIGINT UNSIGNED NULL AFTER `platform_fee`,
    ADD COLUMN IF NOT EXISTS `shipping_wallet_status` VARCHAR(40) NULL AFTER `shipping_wallet_ledger_id`,
    ADD COLUMN IF NOT EXISTS `shipping_charge_myr` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `shipping_wallet_status`,
    ADD COLUMN IF NOT EXISTS `shipping_charge_original_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `shipping_charge_myr`,
    ADD COLUMN IF NOT EXISTS `shipping_charge_original_currency` VARCHAR(10) NULL AFTER `shipping_charge_original_amount`,
    ADD COLUMN IF NOT EXISTS `shipping_fx_rate_to_myr` DECIMAL(18,8) NULL AFTER `shipping_charge_original_currency`;
