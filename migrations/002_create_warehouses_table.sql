-- ============================================================
-- Migration: 002_create_warehouses_table.sql
-- Run AFTER: 001_create_auth_tables.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS `warehouses` (
    `id`           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `company_id`   INT UNSIGNED   NOT NULL,
    `name`         VARCHAR(150)   NOT NULL,
    `code`         VARCHAR(20)    NOT NULL  COMMENT 'Auto-generated short code e.g. WH-001',
    `attribute`    ENUM('own_warehouse','third_party_warehouse') NOT NULL DEFAULT 'own_warehouse',
    `manager_name` VARCHAR(100)   DEFAULT NULL,
    `phone`        VARCHAR(30)    DEFAULT NULL,
    `location`     TEXT           DEFAULT NULL  COMMENT 'Full address / location string',
    `city`         VARCHAR(100)   DEFAULT NULL,
    `country`      VARCHAR(100)   DEFAULT NULL,
    `is_default`   TINYINT(1)     NOT NULL DEFAULT 0,
    `status`       ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `created_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    UNIQUE KEY `uq_warehouses_company_code`    (`company_id`, `code`),
    KEY        `idx_warehouses_company_status` (`company_id`, `status`),
    KEY        `idx_warehouses_company_default`(`company_id`, `is_default`),

    CONSTRAINT `fk_warehouses_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Warehouses per company — scoped by company_id';


-- Now add the FK from user_warehouse_permissions → warehouses
-- (was commented out in migration 001 since warehouses didn't exist yet)
ALTER TABLE `user_warehouse_permissions`
    ADD CONSTRAINT `fk_uwp_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;