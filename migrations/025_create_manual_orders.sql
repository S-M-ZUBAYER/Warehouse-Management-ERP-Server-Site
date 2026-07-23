-- ============================================================
-- Migration: 025_create_manual_orders.sql
-- Description: Stores manual/gift orders and their SKU lines.
-- ============================================================

CREATE TABLE IF NOT EXISTS `manual_orders` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`          INT UNSIGNED    NOT NULL,
    `warehouse_id`        INT UNSIGNED    NOT NULL,
    `order_number`        VARCHAR(100)    NOT NULL,
    `type`                ENUM('manual_order', 'gift') NOT NULL DEFAULT 'manual_order',
    `status`              ENUM('pushing', 'pushed', 'cancelled', 'withdrawn') NOT NULL DEFAULT 'pushing',
    `logistic_service_id` VARCHAR(100)    NULL,
    `logistic_company`    VARCHAR(150)    NULL,
    `logistic_raw`        JSON            NULL,
    `tracking_number`     VARCHAR(150)    NULL,
    `currency`            VARCHAR(10)     NULL,
    `buyer_name`          VARCHAR(150)    NULL,
    `buyer_phone`         VARCHAR(50)     NULL,
    `buyer_address`       TEXT            NULL,
    `buyer_country`       VARCHAR(100)    NULL,
    `buyer_state`         VARCHAR(100)    NULL,
    `buyer_city`          VARCHAR(100)    NULL,
    `buyer_area`          VARCHAR(100)    NULL,
    `buyer_zip_code`      VARCHAR(30)     NULL,
    `payment_type`        VARCHAR(30)     NULL,
    `order_income`        DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `subtotal`            DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `discounts`           DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `shipping_fee`        DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `order_value`         DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `order_time`          DATETIME        NULL,
    `package_weight`      DECIMAL(12,3)   NULL,
    `package_length`      DECIMAL(12,3)   NULL,
    `package_width`       DECIMAL(12,3)   NULL,
    `package_height`      DECIMAL(12,3)   NULL,
    `created_by`          INT UNSIGNED    NULL,
    `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`          DATETIME        NULL,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_manual_orders_company_order` (`company_id`, `order_number`),
    KEY `idx_manual_orders_company_status` (`company_id`, `status`),
    KEY `idx_manual_orders_company_warehouse` (`company_id`, `warehouse_id`),
    KEY `idx_manual_orders_created_at` (`created_at`),

    CONSTRAINT `fk_manual_orders_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_manual_orders_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Manual and gift orders created inside ERP';

CREATE TABLE IF NOT EXISTS `manual_order_items` (
    `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`         INT UNSIGNED    NOT NULL,
    `manual_order_id`    BIGINT UNSIGNED NOT NULL,
    `merchant_sku_id`    INT UNSIGNED    NOT NULL,
    `warehouse_id`       INT UNSIGNED    NOT NULL,
    `sku`                VARCHAR(100)    NOT NULL,
    `product_name`       VARCHAR(255)    NULL,
    `quantity`           INT UNSIGNED    NOT NULL,
    `unit_price`         DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `weight`             DECIMAL(12,3)   NULL,
    `line_total`         DECIMAL(15,2)   NOT NULL DEFAULT 0,
    `image_url`          LONGTEXT        NULL,
    `qty_on_hand_before` INT             NULL,
    `qty_on_hand_after`  INT             NULL,
    `created_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_moi_company` (`company_id`),
    KEY `idx_moi_order` (`manual_order_id`),
    KEY `idx_moi_merchant_sku` (`merchant_sku_id`),

    CONSTRAINT `fk_moi_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_moi_order`
        FOREIGN KEY (`manual_order_id`) REFERENCES `manual_orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_moi_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_moi_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SKU lines for manual/gift orders';
