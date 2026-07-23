-- ============================================================
-- Migration: 003_create_roles_table.sql
-- Run AFTER: 001_create_auth_tables.sql
-- Note: roles table was already created in 001, this migration
--       ensures the underscored timestamps and correct columns exist.
--       If you ran 001 already, use ALTER statements below instead.
-- ============================================================

-- Option A: If roles table does NOT exist yet
CREATE TABLE IF NOT EXISTS `roles` (
    `id`                         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`                 INT UNSIGNED  NOT NULL,
    `name`                       VARCHAR(100)  NOT NULL,
    `description`                TEXT          DEFAULT NULL,
    `permissions`                JSON          DEFAULT NULL
        COMMENT 'Page-level access: {dashboard:{access:true}, product_management:{access:true,sub:{merchant_sku:true}}}',
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


-- Option B: If roles table already exists from migration 001
--           Run these ALTER statements to ensure correct structure:
-- ALTER TABLE `roles`
--     MODIFY COLUMN `permissions` JSON DEFAULT NULL
--         COMMENT 'Page-level access map',
--     MODIFY COLUMN `sub_account_linking_status` ENUM('linked','not_linked') NOT NULL DEFAULT 'not_linked',
--     MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;


-- ─── Permission structure reference ──────────────────────────────────────────
-- Stored in permissions JSON column:
-- {
--   "dashboard":            { "access": true },
--   "product_management":   { "access": true,  "sub": { "merchant_sku": true, "combine_sku": false, "sku_mapping": true } },
--   "inventory_management": { "access": false, "sub": { "inventory_list": false, "inbound": false } },
--   "order_management":     { "access": true,  "sub": { "all_orders": true, "manual_orders": false } },
--   "warehouse_management": { "access": false },
--   "system_configuration": { "access": false, "sub": { "store_authorization": false, "sub_account": false, "role_management": false } }
-- }
-- ─────────────────────────────────────────────────────────────────────────────


-- Verify
SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'roles';