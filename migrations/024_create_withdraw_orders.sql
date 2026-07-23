-- ============================================================
-- Migration: 024_create_withdraw_orders.sql
-- Description: Stores marketplace orders marked for withdraw handling.
-- ============================================================

CREATE TABLE IF NOT EXISTS `withdraw_orders` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`  INT UNSIGNED    NOT NULL,
    `platform`    ENUM('shopee', 'tiktok') NOT NULL,
    `store_id`    VARCHAR(100)    NOT NULL,
    `order_id`    VARCHAR(100)    NOT NULL,
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_withdraw_order` (`company_id`, `platform`, `store_id`, `order_id`),
    KEY `idx_wo_company_platform_store` (`company_id`, `platform`, `store_id`),
    KEY `idx_wo_created_at` (`created_at`),

    CONSTRAINT `fk_wo_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Withdraw marketplace orders retained for up to 7 days';
