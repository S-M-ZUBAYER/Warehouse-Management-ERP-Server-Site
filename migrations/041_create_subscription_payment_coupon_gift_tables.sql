-- ============================================================
-- Migration: 041_create_subscription_payment_coupon_gift_tables.sql
-- Description: Store-based subscription, demo payment, coupon, and gift tables
-- ============================================================

CREATE TABLE IF NOT EXISTS `billing_plans` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
    `duration_days` INT UNSIGNED NOT NULL DEFAULT 0,
    `is_trial` TINYINT(1) NOT NULL DEFAULT 0,
    `badge_label` VARCHAR(60) NULL DEFAULT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_billing_plans_code` (`code`),
    KEY `idx_billing_plans_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `billing_plan_translations` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` INT UNSIGNED NOT NULL,
    `language` VARCHAR(10) NOT NULL DEFAULT 'en',
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bpt_plan_language` (`plan_id`, `language`),
    CONSTRAINT `fk_bpt_plan` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `billing_plan_features` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` INT UNSIGNED NOT NULL,
    `serial_no` INT UNSIGNED NOT NULL DEFAULT 1,
    `feature_key` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `translations` JSON NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bpf_plan_feature` (`plan_id`, `feature_key`),
    KEY `idx_bpf_plan_serial` (`plan_id`, `serial_no`),
    CONSTRAINT `fk_bpf_plan` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `billing_plan_prices` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` INT UNSIGNED NOT NULL,
    `country` CHAR(2) NOT NULL DEFAULT 'US',
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `compare_amount` DECIMAL(12,2) NULL DEFAULT NULL,
    `is_available` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bpp_plan_country_currency` (`plan_id`, `country`, `currency`),
    KEY `idx_bpp_country_currency_available` (`country`, `currency`, `is_available`),
    CONSTRAINT `fk_bpp_plan` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `store_subscriptions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `canonical_key` VARCHAR(320) NOT NULL,
    `platform` VARCHAR(30) NOT NULL,
    `marketplace_country` VARCHAR(10) NULL DEFAULT NULL,
    `external_shop_id` VARCHAR(120) NOT NULL,
    `current_plan_id` INT UNSIGNED NULL DEFAULT NULL,
    `status` ENUM('trial','active','expired') NOT NULL DEFAULT 'trial',
    `trial_started_at` DATETIME NULL DEFAULT NULL,
    `trial_used` TINYINT(1) NOT NULL DEFAULT 0,
    `expires_at` DATETIME NULL DEFAULT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_store_subscriptions_canonical` (`canonical_key`),
    KEY `idx_ss_store_identity` (`platform`, `marketplace_country`, `external_shop_id`),
    KEY `idx_ss_status_expiry` (`status`, `expires_at`),
    CONSTRAINT `fk_ss_current_plan` FOREIGN KEY (`current_plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_payments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_uid` VARCHAR(80) NOT NULL,
    `payment_group_uid` VARCHAR(80) NOT NULL,
    `store_subscription_id` INT UNSIGNED NOT NULL,
    `platform_store_id` INT UNSIGNED NULL DEFAULT NULL,
    `purchaser_company_id` INT UNSIGNED NULL DEFAULT NULL,
    `purchaser_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `purchaser_email` VARCHAR(150) NULL DEFAULT NULL,
    `plan_id` INT UNSIGNED NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `amount` DECIMAL(12,2) NOT NULL,
    `payment_provider` VARCHAR(40) NOT NULL DEFAULT 'mock',
    `payment_status` ENUM('pending','succeeded','failed') NOT NULL DEFAULT 'succeeded',
    `paid_at` DATETIME NULL DEFAULT NULL,
    `previous_expiry` DATETIME NULL DEFAULT NULL,
    `new_expiry` DATETIME NULL DEFAULT NULL,
    `coupon_code` VARCHAR(20) NULL DEFAULT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_subscription_payments_uid` (`payment_uid`),
    KEY `idx_subscription_payments_group` (`payment_group_uid`),
    KEY `idx_subscription_payments_store` (`store_subscription_id`, `created_at`),
    KEY `idx_subscription_payments_company_status` (`purchaser_company_id`, `payment_status`),
    CONSTRAINT `fk_sp_subscription` FOREIGN KEY (`store_subscription_id`) REFERENCES `store_subscriptions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_sp_platform_store` FOREIGN KEY (`platform_store_id`) REFERENCES `platform_stores` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_sp_plan` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `owner_company_id` INT UNSIGNED NULL DEFAULT NULL,
    `owner_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `source_payment_id` INT UNSIGNED NULL DEFAULT NULL,
    `status` ENUM('active','redeemed','expired','cancelled') NOT NULL DEFAULT 'active',
    `redeemed_at` DATETIME NULL DEFAULT NULL,
    `redeemed_by_company_id` INT UNSIGNED NULL DEFAULT NULL,
    `redeemed_by_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `redeemed_store_subscription_id` INT UNSIGNED NULL DEFAULT NULL,
    `gift_id` INT UNSIGNED NULL DEFAULT NULL,
    `max_redemption_count` INT UNSIGNED NOT NULL DEFAULT 1,
    `redemption_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_coupons_code` (`code`),
    KEY `idx_coupons_owner` (`owner_company_id`, `owner_user_id`),
    KEY `idx_coupons_status` (`status`),
    CONSTRAINT `fk_coupons_source_payment` FOREIGN KEY (`source_payment_id`) REFERENCES `subscription_payments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `coupon_id` INT UNSIGNED NOT NULL,
    `redeemer_company_id` INT UNSIGNED NULL DEFAULT NULL,
    `redeemer_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `store_subscription_id` INT UNSIGNED NOT NULL,
    `source_payment_group_uid` VARCHAR(80) NULL DEFAULT NULL,
    `status` ENUM('applied','rejected') NOT NULL DEFAULT 'applied',
    `metadata` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_coupon_store_redemption` (`coupon_id`, `store_subscription_id`),
    KEY `idx_coupon_redemptions_redeemer` (`redeemer_company_id`, `redeemer_user_id`),
    CONSTRAINT `fk_cr_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_cr_subscription` FOREIGN KEY (`store_subscription_id`) REFERENCES `store_subscriptions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gifts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `coupon_id` INT UNSIGNED NOT NULL,
    `coupon_redemption_id` INT UNSIGNED NOT NULL,
    `recipient_company_id` INT UNSIGNED NULL DEFAULT NULL,
    `recipient_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `store_subscription_id` INT UNSIGNED NOT NULL,
    `status` ENUM('PENDING_ADDRESS','ADDRESS_SUBMITTED','ON_THE_WAY','DELIVERED','RECEIVED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING_ADDRESS',
    `delivery_address` JSON NULL,
    `tracking_number` VARCHAR(120) NULL DEFAULT NULL,
    `modal_seen_at` DATETIME NULL DEFAULT NULL,
    `received_at` DATETIME NULL DEFAULT NULL,
    `received_by_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `declined_at` DATETIME NULL DEFAULT NULL,
    `declined_by_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_gifts_redemption` (`coupon_redemption_id`),
    KEY `idx_gifts_recipient_status` (`recipient_company_id`, `recipient_user_id`, `status`),
    CONSTRAINT `fk_gifts_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_gifts_redemption` FOREIGN KEY (`coupon_redemption_id`) REFERENCES `coupon_redemptions` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_gifts_subscription` FOREIGN KEY (`store_subscription_id`) REFERENCES `store_subscriptions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gift_status_history` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `gift_id` INT UNSIGNED NOT NULL,
    `previous_status` VARCHAR(40) NULL DEFAULT NULL,
    `new_status` VARCHAR(40) NOT NULL,
    `changed_by_user_id` INT UNSIGNED NULL DEFAULT NULL,
    `note` TEXT NULL,
    `tracking_number` VARCHAR(120) NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_gift_status_history_gift` (`gift_id`, `created_at`),
    CONSTRAINT `fk_gsh_gift` FOREIGN KEY (`gift_id`) REFERENCES `gifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `billing_plans` (`name`, `code`, `is_active`, `sort_order`, `duration_days`, `is_trial`, `badge_label`)
VALUES
('Free', 'free', 1, 0, 14, 1, 'Trial'),
('Basic', 'basic', 1, 1, 90, 0, NULL),
('Standard', 'standard', 1, 2, 180, 0, 'Popular'),
('Pro', 'pro', 1, 3, 365, 0, NULL),
('Ultimate', 'ultimate', 1, 4, 730, 0, NULL)
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `is_active` = VALUES(`is_active`),
    `sort_order` = VALUES(`sort_order`),
    `duration_days` = VALUES(`duration_days`),
    `is_trial` = VALUES(`is_trial`),
    `badge_label` = VALUES(`badge_label`);

INSERT INTO `billing_plan_translations` (`plan_id`, `language`, `display_name`, `description`)
SELECT `id`, 'en', `name`, CONCAT(`duration_days`, ' days store subscription') FROM `billing_plans`
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`), `description` = VALUES(`description`);

INSERT INTO `billing_plan_features` (`plan_id`, `serial_no`, `feature_key`, `title`, `description`)
SELECT `id`, 1, 'duration', CONCAT(`duration_days`, ' days subscription duration'), 'Duration is configured from backend plan settings.' FROM `billing_plans`
ON DUPLICATE KEY UPDATE `serial_no` = VALUES(`serial_no`), `title` = VALUES(`title`), `description` = VALUES(`description`);

INSERT INTO `billing_plan_features` (`plan_id`, `serial_no`, `feature_key`, `title`, `description`)
SELECT `id`, 2, 'orders', 'Access to current marketplace orders', 'Order access is controlled by active store subscription.' FROM `billing_plans`
ON DUPLICATE KEY UPDATE `serial_no` = VALUES(`serial_no`), `title` = VALUES(`title`), `description` = VALUES(`description`);

INSERT INTO `billing_plan_features` (`plan_id`, `serial_no`, `feature_key`, `title`, `description`)
SELECT `id`, 3, 'fulfillment', 'Package and ship orders directly', 'Use ERP fulfillment tools while the store subscription is active.' FROM `billing_plans`
ON DUPLICATE KEY UPDATE `serial_no` = VALUES(`serial_no`), `title` = VALUES(`title`), `description` = VALUES(`description`);

INSERT INTO `billing_plan_features` (`plan_id`, `serial_no`, `feature_key`, `title`, `description`)
SELECT `id`, 4, 'bulk_processing', 'Process multiple orders at once', 'Batch workflows are available for active stores.' FROM `billing_plans`
ON DUPLICATE KEY UPDATE `serial_no` = VALUES(`serial_no`), `title` = VALUES(`title`), `description` = VALUES(`description`);

INSERT INTO `billing_plan_features` (`plan_id`, `serial_no`, `feature_key`, `title`, `description`)
SELECT `id`, 5, 'support', 'Customer support available', 'Support is available during the subscription period.' FROM `billing_plans`
ON DUPLICATE KEY UPDATE `serial_no` = VALUES(`serial_no`), `title` = VALUES(`title`), `description` = VALUES(`description`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'US', 'USD',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 3 WHEN 'standard' THEN 5 WHEN 'pro' THEN 9 WHEN 'ultimate' THEN 16 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'CN', 'CNY',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 22 WHEN 'standard' THEN 36 WHEN 'pro' THEN 65 WHEN 'ultimate' THEN 116 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'SG', 'SGD',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 4 WHEN 'standard' THEN 7 WHEN 'pro' THEN 12 WHEN 'ultimate' THEN 22 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'MY', 'MYR',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 14 WHEN 'standard' THEN 24 WHEN 'pro' THEN 43 WHEN 'ultimate' THEN 77 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'TH', 'THB',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 105 WHEN 'standard' THEN 175 WHEN 'pro' THEN 315 WHEN 'ultimate' THEN 560 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'PH', 'PHP',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 170 WHEN 'standard' THEN 285 WHEN 'pro' THEN 515 WHEN 'ultimate' THEN 910 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'ID', 'IDR',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 48000 WHEN 'standard' THEN 80000 WHEN 'pro' THEN 144000 WHEN 'ultimate' THEN 256000 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);

INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'VN', 'VND',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 76000 WHEN 'standard' THEN 127000 WHEN 'pro' THEN 229000 WHEN 'ultimate' THEN 406000 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `compare_amount` = VALUES(`compare_amount`), `is_available` = VALUES(`is_available`);
