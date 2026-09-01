-- ============================================================
-- Migration: 049_create_platform_order_activity_logs.sql
-- Description: Append-only timeline for Shopee/TikTok platform order actions.
-- ============================================================

CREATE TABLE IF NOT EXISTS `platform_order_activity_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id` INT UNSIGNED NOT NULL,
    `platform` ENUM('shopee', 'tiktok') NOT NULL,
    `platform_store_id` INT UNSIGNED NULL DEFAULT NULL,
    `store_id` VARCHAR(100) NULL DEFAULT NULL,
    `store_name` VARCHAR(255) NULL DEFAULT NULL,
    `platform_order_id` VARCHAR(100) NOT NULL,
    `platform_order_item_id` VARCHAR(100) NULL DEFAULT NULL,
    `package_number` VARCHAR(150) NULL DEFAULT NULL,
    `tracking_number` VARCHAR(150) NULL DEFAULT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `message` TEXT NULL DEFAULT NULL,
    `old_status` VARCHAR(80) NULL DEFAULT NULL,
    `new_status` VARCHAR(80) NULL DEFAULT NULL,
    `actor_type` ENUM('USER', 'SYSTEM', 'WEBHOOK', 'SYNC_JOB', 'PLATFORM') NOT NULL DEFAULT 'SYSTEM',
    `actor_id` INT UNSIGNED NULL DEFAULT NULL,
    `actor_name` VARCHAR(150) NULL DEFAULT NULL,
    `source` VARCHAR(100) NULL DEFAULT NULL,
    `source_event_id` VARCHAR(180) NULL DEFAULT NULL,
    `metadata` JSON NULL DEFAULT NULL,
    `occurred_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_poal_source_event` (`company_id`, `platform`, `source_event_id`),
    KEY `idx_poal_order` (`company_id`, `platform`, `platform_order_id`),
    KEY `idx_poal_event_type` (`company_id`, `platform`, `event_type`),
    KEY `idx_poal_platform_store` (`platform_store_id`),
    KEY `idx_poal_occurred_at` (`occurred_at`),

    CONSTRAINT `fk_poal_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_poal_platform_store`
        FOREIGN KEY (`platform_store_id`) REFERENCES `platform_stores` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_poal_actor`
        FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Append-only activity timeline for platform orders';
