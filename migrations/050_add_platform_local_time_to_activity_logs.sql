-- ============================================================
-- Migration: 050_add_platform_local_time_to_activity_logs.sql
-- Description: Store platform/store local time display fields for order activity logs.
-- ============================================================

ALTER TABLE `platform_order_activity_logs`
    ADD COLUMN `platform_region` VARCHAR(10) NULL DEFAULT NULL AFTER `source_event_id`,
    ADD COLUMN `platform_timezone` VARCHAR(80) NULL DEFAULT NULL AFTER `platform_region`,
    ADD COLUMN `platform_local_occurred_at` VARCHAR(30) NULL DEFAULT NULL AFTER `platform_timezone`;
