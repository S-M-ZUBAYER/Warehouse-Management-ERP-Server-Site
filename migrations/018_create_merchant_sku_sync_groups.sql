-- ============================================================
-- Migration: 018_create_merchant_sku_sync_groups.sql
-- Description:
--   Implements the "TP870 ↔ TP890 linked SKU" feature.
--
--   merchant_sku_sync_groups:
--     A group has a PRIMARY merchant SKU (e.g. TP870) and one or more
--     SECONDARY merchant SKUs (e.g. TP890, TP910).
--     When stock moves on ANY member of the group, ALL members update.
--
--   Rules enforced by application logic (not FK alone):
--     1. A secondary SKU can only join a group if it is NOT already mapped
--        to any platform store that TP870 is also mapped to (same warehouse only rule).
--     2. A SKU can only belong to ONE group at a time.
--     3. Only the primary SKU's platform_sku_mappings are written to the
--        platform — secondary SKUs shadow the primary's platform stock.
-- ============================================================

CREATE TABLE IF NOT EXISTS `merchant_sku_sync_groups` (
    `id`                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`         INT UNSIGNED  NOT NULL,
    -- The "master" merchant SKU — stock is the source of truth
    `primary_sku_id`     INT UNSIGNED  NOT NULL,
    `name`               VARCHAR(100)  NULL DEFAULT NULL COMMENT 'Optional human-readable group label',
    `created_by`         INT UNSIGNED  NULL DEFAULT NULL,
    `created_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`         DATETIME      NULL DEFAULT NULL,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_msg_primary_sku` (`primary_sku_id`),
    KEY `idx_msg_company` (`company_id`),
    KEY `idx_msg_deleted` (`deleted_at`),

    CONSTRAINT `fk_msg_company`
        FOREIGN KEY (`company_id`)     REFERENCES `companies`      (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_msg_primary_sku`
        FOREIGN KEY (`primary_sku_id`) REFERENCES `merchant_skus`  (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Groups merchant SKUs so stock changes are mirrored across all members';


CREATE TABLE IF NOT EXISTS `merchant_sku_sync_members` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `group_id`     INT UNSIGNED  NOT NULL,
    `company_id`   INT UNSIGNED  NOT NULL,
    -- The secondary SKU that mirrors the primary
    `member_sku_id` INT UNSIGNED NOT NULL,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    -- A SKU can only be a secondary member in ONE group
    UNIQUE KEY `uq_mssm_member` (`member_sku_id`),
    KEY `idx_mssm_group`   (`group_id`),
    KEY `idx_mssm_company` (`company_id`),

    CONSTRAINT `fk_mssm_group`
        FOREIGN KEY (`group_id`)      REFERENCES `merchant_sku_sync_groups` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_mssm_company`
        FOREIGN KEY (`company_id`)    REFERENCES `companies`    (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_mssm_member_sku`
        FOREIGN KEY (`member_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Each row = one secondary SKU that mirrors a sync group''s primary SKU stock';