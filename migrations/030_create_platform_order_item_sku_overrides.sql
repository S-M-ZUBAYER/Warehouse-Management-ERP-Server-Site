-- ============================================================
-- Migration: 030_create_platform_order_item_sku_overrides.sql
-- Description: Order-level replacement SKU overrides for Shopee/TikTok
--              packed stock finalization.
-- ============================================================

CREATE TABLE IF NOT EXISTS `platform_order_item_sku_overrides` (
    `id`                            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `company_id`                    INT UNSIGNED    NOT NULL,
    `platform`                      ENUM('shopee', 'tiktok') NOT NULL,
    `platform_order_id`             VARCHAR(100)    NOT NULL,
    `platform_order_item_id`        VARCHAR(100)    NOT NULL,
    `platform_store_id`             INT UNSIGNED    NULL DEFAULT NULL,
    `shop_id`                       VARCHAR(100)    NULL DEFAULT NULL,
    `open_id`                       VARCHAR(100)    NULL DEFAULT NULL,
    `cipher_id`                     VARCHAR(255)    NULL DEFAULT NULL,
    `original_platform_mapping_id`  INT UNSIGNED    NOT NULL,
    `original_merchant_sku_id`      INT UNSIGNED    NULL DEFAULT NULL,
    `original_combine_sku_id`       INT UNSIGNED    NULL DEFAULT NULL,
    `replacement_merchant_sku_id`   INT UNSIGNED    NOT NULL,
    `replacement_warehouse_id`      INT UNSIGNED    NOT NULL,
    `quantity`                      INT UNSIGNED    NOT NULL DEFAULT 1,
    `reason`                        VARCHAR(100)    NULL DEFAULT NULL,
    `note`                          TEXT            NULL DEFAULT NULL,
    `status`                        ENUM('active', 'packed', 'cancelled') NOT NULL DEFAULT 'active',
    `packed_at`                     DATETIME        NULL DEFAULT NULL,
    `created_at`                    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_pois_override_order_item` (`company_id`, `platform`, `platform_order_id`, `platform_order_item_id`),
    KEY `idx_pois_company` (`company_id`),
    KEY `idx_pois_platform_order` (`platform`, `platform_order_id`),
    KEY `idx_pois_original_mapping` (`original_platform_mapping_id`),
    KEY `idx_pois_replacement_sku` (`replacement_merchant_sku_id`),
    KEY `idx_pois_status` (`status`),

    CONSTRAINT `fk_pois_company`
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pois_platform_store`
        FOREIGN KEY (`platform_store_id`) REFERENCES `platform_stores` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pois_original_mapping`
        FOREIGN KEY (`original_platform_mapping_id`) REFERENCES `platform_sku_mappings` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pois_original_merchant_sku`
        FOREIGN KEY (`original_merchant_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pois_original_combine_sku`
        FOREIGN KEY (`original_combine_sku_id`) REFERENCES `combine_skus` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pois_replacement_merchant_sku`
        FOREIGN KEY (`replacement_merchant_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_pois_replacement_warehouse`
        FOREIGN KEY (`replacement_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_pois_quantity` CHECK (`quantity` > 0)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Order item replacement SKU overrides for platform packed stock';
