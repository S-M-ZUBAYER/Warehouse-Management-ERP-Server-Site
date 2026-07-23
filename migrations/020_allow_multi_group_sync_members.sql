-- ============================================================
-- Migration: 020_allow_multi_group_sync_members.sql
-- Description:
--   Allows one merchant SKU to be a child/member in multiple sync groups and
--   also remain eligible to be a parent SKU in its own group.
-- ============================================================

-- MySQL 8+ supports DROP INDEX IF EXISTS only in newer versions; for older
-- versions, run the DROP INDEX manually if the index exists.
ALTER TABLE `merchant_sku_sync_members`
    DROP INDEX `uq_mssm_member`;

-- Prevent duplicate child rows inside the same parent group while allowing the
-- same child SKU in other groups.
CREATE UNIQUE INDEX `uq_mssm_group_member`
    ON `merchant_sku_sync_members` (`group_id`, `member_sku_id`);

CREATE INDEX `idx_mssm_member_sku`
    ON `merchant_sku_sync_members` (`member_sku_id`);
