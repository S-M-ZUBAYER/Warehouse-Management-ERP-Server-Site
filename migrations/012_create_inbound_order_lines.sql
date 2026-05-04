-- ============================================================
-- Migration: 012_create_inbound_order_lines.sql
-- Description: Line items within an inbound order — one row per SKU per inbound
-- ============================================================

CREATE TABLE IF NOT EXISTS `inbound_order_lines` (
    `id`                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`          INT UNSIGNED     NOT NULL,
    `inbound_order_id`    INT UNSIGNED     NOT NULL,
    `merchant_sku_id`     INT UNSIGNED     NOT NULL,

    -- Quantities
    `qty_expected`        INT UNSIGNED     NOT NULL DEFAULT 0
        COMMENT 'Planned quantity declared in the draft',
    `qty_received`        INT UNSIGNED     NOT NULL DEFAULT 0
        COMMENT 'Actual quantity counted at warehouse receipt',

    -- Per-unit cost at time of inbound (for COGS tracking)
    `unit_cost`           DECIMAL(15,2)    NULL DEFAULT NULL,
    `currency`            VARCHAR(10)      NULL DEFAULT NULL,

    -- Discrepancy flag (set when qty_received != qty_expected after completion)
    `has_discrepancy`     TINYINT(1)       NOT NULL DEFAULT 0,
    `discrepancy_notes`   VARCHAR(500)     NULL DEFAULT NULL,

    `created_at`          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- One SKU per inbound order
    UNIQUE KEY `uq_inbound_order_lines` (`inbound_order_id`, `merchant_sku_id`),

    KEY `idx_iol_company`         (`company_id`),
    KEY `idx_iol_inbound_order`   (`inbound_order_id`),
    KEY `idx_iol_merchant_sku`    (`merchant_sku_id`),
    KEY `idx_iol_discrepancy`     (`has_discrepancy`),

    CONSTRAINT `fk_iol_company`
        FOREIGN KEY (`company_id`)       REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_iol_inbound_order`
        FOREIGN KEY (`inbound_order_id`) REFERENCES `inbound_orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_iol_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`)  REFERENCES `merchant_skus` (`id`) ON DELETE RESTRICT,

    CONSTRAINT `chk_iol_qty_expected` CHECK (`qty_expected` >= 0),
    CONSTRAINT `chk_iol_qty_received` CHECK (`qty_received` >= 0)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Line items within an inbound shipment — one row per SKU';