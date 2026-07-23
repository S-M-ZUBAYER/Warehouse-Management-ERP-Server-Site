-- ============================================================
-- Migration: 022_create_pack_failed_orders.sql
-- Description: Stores failed marketplace order pack attempts for retry UI.
-- ============================================================

CREATE TABLE IF NOT EXISTS `pack_failed_orders` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`  INT UNSIGNED    NOT NULL,
    `platform`    ENUM('shopee', 'tiktok') NOT NULL,
    `store_id`    VARCHAR(100)    NOT NULL,
    `order_id`    VARCHAR(100)    NOT NULL,
    `reason`      VARCHAR(500)    NOT NULL,
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_pack_failed_order` (`company_id`, `platform`, `store_id`, `order_id`),
    KEY `idx_pfo_company_platform_store` (`company_id`, `platform`, `store_id`),
    KEY `idx_pfo_created_at` (`created_at`),

    CONSTRAINT `fk_pfo_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Failed order pack attempts retained for retry for up to 7 days';
