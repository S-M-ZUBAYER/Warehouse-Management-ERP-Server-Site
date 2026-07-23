-- ============================================================
-- Migration: 023_create_push_successful_orders.sql
-- Description: Stores marketplace orders that were pushed successfully.
-- ============================================================

CREATE TABLE IF NOT EXISTS `push_successful_orders` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`  INT UNSIGNED    NOT NULL,
    `platform`    ENUM('shopee', 'tiktok') NOT NULL,
    `store_id`    VARCHAR(100)    NOT NULL,
    `order_id`    VARCHAR(100)    NOT NULL,
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_push_successful_order` (`company_id`, `platform`, `store_id`, `order_id`),
    KEY `idx_pso_company_platform_store` (`company_id`, `platform`, `store_id`),
    KEY `idx_pso_created_at` (`created_at`),

    CONSTRAINT `fk_pso_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Successfully pushed marketplace orders retained for up to 7 days';
