-- ============================================================
-- Migration: 001_create_auth_tables.sql
-- Creates: companies, roles, users, user_store_permissions,
--          user_warehouse_permissions
-- Run order matters — FK dependencies go top to bottom
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────
-- Table 1: companies  (master tenant — everything references this)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `companies` (
    `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `name`              VARCHAR(200)    NOT NULL,
    `slug`              VARCHAR(220)    NOT NULL,
    `email`             VARCHAR(150)    NOT NULL,
    `phone`             VARCHAR(30)     DEFAULT NULL,
    `logo_url`          TEXT            DEFAULT NULL,
    `plan`              ENUM('starter','growth','enterprise','trial') NOT NULL DEFAULT 'trial',
    `status`            ENUM('active','suspended','trial')            NOT NULL DEFAULT 'trial',
    `trial_ends_at`     DATETIME        DEFAULT NULL,
    `timezone`          VARCHAR(50)     NOT NULL DEFAULT 'UTC',
    `currency`          CHAR(3)         NOT NULL DEFAULT 'USD',
    `dedicated_db_host` VARCHAR(255)    DEFAULT NULL,
    `dedicated_db_name` VARCHAR(100)    DEFAULT NULL,
    `dedicated_db_user` VARCHAR(100)    DEFAULT NULL,
    `dedicated_db_pass` TEXT            DEFAULT NULL COMMENT 'AES-256 encrypted',
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_companies_slug`  (`slug`),
    UNIQUE KEY `uq_companies_email` (`email`),
    KEY        `idx_companies_status` (`status`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Master tenant table — one row per registered company';


-- ─────────────────────────────────────────────────────────────
-- Table 2: roles  (custom roles per company)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
    `id`                         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`                 INT UNSIGNED  NOT NULL,
    `name`                       VARCHAR(100)  NOT NULL,
    `description`                TEXT          DEFAULT NULL,
    `permissions`                JSON          DEFAULT NULL COMMENT 'Page-level access map e.g. {dashboard:true, inventory:true}',
    `sub_account_linking_status` ENUM('linked','not_linked') NOT NULL DEFAULT 'not_linked',
    `created_at`                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_roles_company_name` (`company_id`, `name`),
    KEY        `idx_roles_company_id`  (`company_id`),

    CONSTRAINT `fk_roles_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Custom roles per company with JSON permission sets';


-- ─────────────────────────────────────────────────────────────
-- Table 3: users  (admin + sub accounts — all in one table)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `company_id`    INT UNSIGNED    NOT NULL,
    `role_id`       INT UNSIGNED    DEFAULT NULL COMMENT 'FK to roles — nullable for owner bootstrap',
    `name`          VARCHAR(100)    NOT NULL,
    `email`         VARCHAR(150)    NOT NULL,
    `password`      VARCHAR(255)    NOT NULL COMMENT 'bcrypt hashed',
    `role`          ENUM('owner','admin','manager','staff','viewer') NOT NULL DEFAULT 'staff',
    `avatar_url`    TEXT            DEFAULT NULL,
    `account_id`    VARCHAR(50)     DEFAULT NULL COMMENT 'Custom employee ID shown in UI e.g. EMP-001',
    `department`    VARCHAR(100)    DEFAULT NULL,
    `designation`   VARCHAR(100)    DEFAULT NULL,
    `phone`         VARCHAR(30)     DEFAULT NULL,
    `address`       TEXT            DEFAULT NULL,
    `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
    `last_login_at` DATETIME        DEFAULT NULL,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- Email unique per company (not globally)
    UNIQUE KEY `uq_users_company_email`      (`company_id`, `email`),
    -- Account ID unique per company
    UNIQUE KEY `uq_users_company_account_id` (`company_id`, `account_id`),

    -- Query indexes
    KEY `idx_users_company_role`   (`company_id`, `role`),
    KEY `idx_users_company_active` (`company_id`, `is_active`),
    KEY `idx_users_role_id`        (`role_id`),

    CONSTRAINT `fk_users_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT `fk_users_role`
        FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='All users — company owner (admin) and sub accounts. Scoped by company_id.';


-- ─────────────────────────────────────────────────────────────
-- Table 4: user_store_permissions
-- (which sub accounts can access which platform stores)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_store_permissions` (
    `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`    INT UNSIGNED  NOT NULL,
    `user_id`       INT UNSIGNED  NOT NULL,
    `connection_id` INT UNSIGNED  NOT NULL COMMENT 'FK → platform_connections (added when that table exists)',
    `can_view`      TINYINT(1)    NOT NULL DEFAULT 1,
    `can_edit`      TINYINT(1)    NOT NULL DEFAULT 0,
    `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_usp_company_user_conn` (`company_id`, `user_id`, `connection_id`),
    KEY        `idx_usp_company_user`     (`company_id`, `user_id`),

    CONSTRAINT `fk_usp_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE

    -- NOTE: FK to platform_connections added in migration 002 when that table is created
    -- CONSTRAINT `fk_usp_connection`
    --     FOREIGN KEY (`connection_id`) REFERENCES `platform_connections` (`id`)
    --     ON DELETE CASCADE ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Which users can view/edit which platform store connections';


-- ─────────────────────────────────────────────────────────────
-- Table 5: user_warehouse_permissions
-- (which sub accounts can access which warehouses)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_warehouse_permissions` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`   INT UNSIGNED  NOT NULL,
    `user_id`      INT UNSIGNED  NOT NULL,
    `warehouse_id` INT UNSIGNED  NOT NULL COMMENT 'FK → warehouses (added when that table exists)',
    `can_view`     TINYINT(1)    NOT NULL DEFAULT 1,
    `can_edit`     TINYINT(1)    NOT NULL DEFAULT 0,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_uwp_company_user_wh` (`company_id`, `user_id`, `warehouse_id`),

    CONSTRAINT `fk_uwp_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE

    -- NOTE: FK to warehouses added in migration 003 when that table is created
    -- CONSTRAINT `fk_uwp_warehouse`
    --     FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
    --     ON DELETE CASCADE ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Which users can view/edit which warehouses';


SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────────────────────
-- Verify tables were created
-- ─────────────────────────────────────────────────────────────
SELECT
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
      'companies',
      'roles',
      'users',
      'user_store_permissions',
      'user_warehouse_permissions'
  )
ORDER BY CREATE_TIME;