-- ============================================================
-- Migration: 026_update_manual_orders_for_logistics.sql
-- Description: Adds full Manual Order logistics, COD, EasyParcel AWB and status tracking fields.
-- Note: If your MySQL/MariaDB version does not support IF NOT EXISTS for ADD COLUMN,
--       run only the missing column lines manually.
-- ============================================================

ALTER TABLE `manual_orders`
    MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'CREATED';

ALTER TABLE `manual_orders`
    ADD COLUMN IF NOT EXISTS `shipment_status` VARCHAR(50) NOT NULL DEFAULT 'CREATED' AFTER `status`,
    ADD COLUMN IF NOT EXISTS `cod_status` VARCHAR(50) NOT NULL DEFAULT 'COD_NOT_APPLICABLE' AFTER `shipment_status`,
    ADD COLUMN IF NOT EXISTS `booking_status` VARCHAR(50) NOT NULL DEFAULT 'SAVED_ONLY' AFTER `cod_status`,
    ADD COLUMN IF NOT EXISTS `awb_number` VARCHAR(150) NULL AFTER `tracking_number`,
    ADD COLUMN IF NOT EXISTS `provider_order_number` VARCHAR(150) NULL AFTER `awb_number`,
    ADD COLUMN IF NOT EXISTS `provider_shipment_number` VARCHAR(150) NULL AFTER `provider_order_number`,
    ADD COLUMN IF NOT EXISTS `parcel_number` VARCHAR(150) NULL AFTER `provider_shipment_number`,
    ADD COLUMN IF NOT EXISTS `waybill_pdf_url` LONGTEXT NULL AFTER `parcel_number`,
    ADD COLUMN IF NOT EXISTS `waybill_pdf_filename` VARCHAR(255) NULL AFTER `waybill_pdf_url`,
    ADD COLUMN IF NOT EXISTS `tracking_url` LONGTEXT NULL AFTER `waybill_pdf_filename`,
    ADD COLUMN IF NOT EXISTS `booking_error` TEXT NULL AFTER `tracking_url`,
    ADD COLUMN IF NOT EXISTS `raw_provider_status` VARCHAR(255) NULL AFTER `booking_error`,
    ADD COLUMN IF NOT EXISTS `easyparcel_country` VARCHAR(10) NULL AFTER `raw_provider_status`,
    ADD COLUMN IF NOT EXISTS `sender_name` VARCHAR(150) NULL AFTER `easyparcel_country`,
    ADD COLUMN IF NOT EXISTS `sender_company` VARCHAR(150) NULL AFTER `sender_name`,
    ADD COLUMN IF NOT EXISTS `sender_phone` VARCHAR(50) NULL AFTER `sender_company`,
    ADD COLUMN IF NOT EXISTS `sender_email` VARCHAR(150) NULL AFTER `sender_phone`,
    ADD COLUMN IF NOT EXISTS `sender_address` TEXT NULL AFTER `sender_email`,
    ADD COLUMN IF NOT EXISTS `sender_country` VARCHAR(20) NULL AFTER `sender_address`,
    ADD COLUMN IF NOT EXISTS `sender_state` VARCHAR(100) NULL AFTER `sender_country`,
    ADD COLUMN IF NOT EXISTS `sender_city` VARCHAR(100) NULL AFTER `sender_state`,
    ADD COLUMN IF NOT EXISTS `sender_postcode` VARCHAR(30) NULL AFTER `sender_city`,
    ADD COLUMN IF NOT EXISTS `sender_unit` VARCHAR(100) NULL AFTER `sender_postcode`,
    ADD COLUMN IF NOT EXISTS `receiver_email` VARCHAR(150) NULL AFTER `sender_unit`,
    ADD COLUMN IF NOT EXISTS `buyer_unit` VARCHAR(100) NULL AFTER `buyer_zip_code`,
    ADD COLUMN IF NOT EXISTS `cod_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `order_value`,
    ADD COLUMN IF NOT EXISTS `cod_fee` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `cod_amount`,
    ADD COLUMN IF NOT EXISTS `platform_fee` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `cod_fee`,
    ADD COLUMN IF NOT EXISTS `package_content` VARCHAR(255) NULL AFTER `package_height`,
    ADD COLUMN IF NOT EXISTS `last_status_checked_at` DATETIME NULL AFTER `package_content`;

CREATE TABLE IF NOT EXISTS `manual_order_status_history` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`          INT UNSIGNED    NOT NULL,
    `manual_order_id`     BIGINT UNSIGNED NOT NULL,
    `old_status`          VARCHAR(50)     NULL,
    `new_status`          VARCHAR(50)     NOT NULL,
    `raw_provider_status` VARCHAR(255)    NULL,
    `note`                TEXT            NULL,
    `created_by`          INT UNSIGNED    NULL,
    `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_mosh_company_order` (`company_id`, `manual_order_id`),
    KEY `idx_mosh_new_status` (`new_status`),
    CONSTRAINT `fk_mosh_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_mosh_manual_order`
        FOREIGN KEY (`manual_order_id`) REFERENCES `manual_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Manual order logistics status history';
