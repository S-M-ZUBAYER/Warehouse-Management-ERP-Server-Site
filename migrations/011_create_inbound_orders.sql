-- ============================================================
-- Migration: 011_create_inbound_orders.sql
-- Description: Inbound shipment orders — 3 stage lifecycle: draft → on_the_way → completed
-- ============================================================

CREATE TABLE IF NOT EXISTS `inbound_orders` (
    `id`                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`            INT UNSIGNED     NOT NULL,
    `warehouse_id`          INT UNSIGNED     NOT NULL COMMENT 'Receiving warehouse',

    -- Human-readable reference (generated on confirm)
    `inbound_id`            VARCHAR(30)      NOT NULL
        COMMENT 'e.g. IB-2024-000001 — generated when draft is confirmed',

    -- Status lifecycle
    `status`                ENUM('draft','on_the_way','completed','cancelled')
                            NOT NULL DEFAULT 'draft',

    -- Shipping details (filled when confirming draft → on_the_way)
    `tracking_number`       VARCHAR(100)     NULL DEFAULT NULL,
    `purchase_currency`     VARCHAR(10)      NULL DEFAULT NULL COMMENT 'e.g. USD, MYR, SGD',
    `exchange_rate`         DECIMAL(15,6)    NULL DEFAULT NULL COMMENT 'Rate vs company base currency at time of order',
    `supplier_name`         VARCHAR(255)     NULL DEFAULT NULL,
    `supplier_reference`    VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Supplier invoice / PO number',
    `shipping_cost`         DECIMAL(15,2)    NULL DEFAULT NULL,
    `notes`                 TEXT             NULL DEFAULT NULL,

    -- Dates
    `estimated_arrival`     DATE             NULL DEFAULT NULL,
    `shipped_at`            DATETIME         NULL DEFAULT NULL COMMENT 'When status changed to on_the_way',
    `arrived_at`            DATETIME         NULL DEFAULT NULL COMMENT 'When status changed to completed',

    `created_by`            INT UNSIGNED     NULL DEFAULT NULL,

    `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`            DATETIME         NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    UNIQUE KEY `uq_inbound_orders_inbound_id` (`company_id`, `inbound_id`),

    KEY `idx_inbound_company`           (`company_id`),
    KEY `idx_inbound_warehouse`         (`warehouse_id`),
    KEY `idx_inbound_status`            (`company_id`, `status`),
    KEY `idx_inbound_created`           (`company_id`, `created_at`),
    KEY `idx_inbound_tracking`          (`tracking_number`),
    KEY `idx_inbound_deleted`           (`deleted_at`),

    CONSTRAINT `fk_inbound_company`
        FOREIGN KEY (`company_id`)   REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_inbound_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Inbound shipment orders: draft → on_the_way → completed';