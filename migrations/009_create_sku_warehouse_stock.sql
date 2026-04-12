-- ============================================================
-- Migration: 009_create_sku_warehouse_stock.sql
-- Description: Real-time stock ledger per merchant SKU per warehouse
--              This is the single source of truth for all inventory quantities.
-- ============================================================

CREATE TABLE IF NOT EXISTS `sku_warehouse_stock` (
    `id`               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`       INT UNSIGNED     NOT NULL,
    `merchant_sku_id`  INT UNSIGNED     NOT NULL,
    `warehouse_id`     INT UNSIGNED     NOT NULL,

    -- Stock counters (all non-negative, managed via atomic transactions)
    `qty_on_hand`      INT              NOT NULL DEFAULT 0
        COMMENT 'Physical units currently in the warehouse',
    `qty_reserved`     INT              NOT NULL DEFAULT 0
        COMMENT 'Units reserved/allocated for pending platform orders',
    `qty_inbound`      INT              NOT NULL DEFAULT 0
        COMMENT 'Units in transit (confirmed inbound, not yet received)',

    -- Computed helper (qty_on_hand - qty_reserved) — updated by trigger or app
    `qty_available`    INT              GENERATED ALWAYS AS (`qty_on_hand` - `qty_reserved`) STORED
        COMMENT 'Available to sell = on_hand minus reserved',

    `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- One stock record per SKU per warehouse
    UNIQUE KEY `uq_sku_warehouse_stock` (`merchant_sku_id`, `warehouse_id`),

    KEY `idx_sws_company`        (`company_id`),
    KEY `idx_sws_merchant_sku`   (`merchant_sku_id`),
    KEY `idx_sws_warehouse`      (`warehouse_id`),
    KEY `idx_sws_available`      (`company_id`, `qty_available`),

    CONSTRAINT `fk_sws_company`
        FOREIGN KEY (`company_id`)      REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sws_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`) REFERENCES `merchant_skus` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sws_warehouse`
        FOREIGN KEY (`warehouse_id`)    REFERENCES `warehouses` (`id`) ON DELETE CASCADE,

    -- Guard: no counter may go negative
    CONSTRAINT `chk_sws_qty_on_hand`  CHECK (`qty_on_hand`  >= 0),
    CONSTRAINT `chk_sws_qty_reserved` CHECK (`qty_reserved` >= 0),
    CONSTRAINT `chk_sws_qty_inbound`  CHECK (`qty_inbound`  >= 0)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Real-time stock levels per merchant SKU per warehouse — source of truth for all inventory';