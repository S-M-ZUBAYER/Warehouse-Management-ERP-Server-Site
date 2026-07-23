-- -- ============================================================
-- -- Migration: 011_create_outbound_orders.sql
-- -- Description: Outbound shipment orders — 3 stage lifecycle: draft → on_the_way → completed
-- -- ============================================================

-- CREATE TABLE IF NOT EXISTS `outbound_orders` (
--     `id`                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
--     `company_id`            INT UNSIGNED     NOT NULL,
--     `warehouse_id`          INT UNSIGNED     NOT NULL COMMENT 'Receiving warehouse',

--     -- Human-readable reference (generated on confirm)
--     `outbound_id`            VARCHAR(30)      NOT NULL
--         COMMENT 'e.g. OB-2024-000001 — generated when draft is confirmed',

--     -- Status lifecycle
--     `status`                ENUM('draft','on_the_way','completed','cancelled')
--                             NOT NULL DEFAULT 'draft',

--     -- Shipping details (filled when confirming draft → on_the_way)
--     `tracking_number`       VARCHAR(100)     NULL DEFAULT NULL,
--     `purchase_currency`     VARCHAR(10)      NULL DEFAULT NULL COMMENT 'e.g. USD, MYR, SGD',
--     `exchange_rate`         DECIMAL(15,6)    NULL DEFAULT NULL COMMENT 'Rate vs company base currency at time of order',
--     `supplier_name`         VARCHAR(255)     NULL DEFAULT NULL,
--     `supplier_reference`    VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Supplier invoice / PO number',
--     `shipping_cost`         DECIMAL(15,2)    NULL DEFAULT NULL,
--     `notes`                 TEXT             NULL DEFAULT NULL,

--     -- Dates
--     `estimated_arrival`     DATE             NULL DEFAULT NULL,
--     `shipped_at`            DATETIME         NULL DEFAULT NULL COMMENT 'When status changed to on_the_way',
--     `arrived_at`            DATETIME         NULL DEFAULT NULL COMMENT 'When status changed to completed',

--     `created_by`            INT UNSIGNED     NULL DEFAULT NULL,

--     `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     `deleted_at`            DATETIME         NULL DEFAULT NULL,

--     PRIMARY KEY (`id`),

--     UNIQUE KEY `uq_outbound_orders_outbound_id` (`company_id`, `outbound_id`),

--     KEY `idx_outbound_company`           (`company_id`),
--     KEY `idx_outbound_warehouse`         (`warehouse_id`),
--     KEY `idx_outbound_status`            (`company_id`, `status`),
--     KEY `idx_outbound_created`           (`company_id`, `created_at`),
--     KEY `idx_outbound_tracking`          (`tracking_number`),
--     KEY `idx_outbound_deleted`           (`deleted_at`),

--     CONSTRAINT `fk_outbound_company`
--         FOREIGN KEY (`company_id`)   REFERENCES `companies` (`id`) ON DELETE CASCADE,
--     CONSTRAINT `fk_outbound_warehouse`
--         FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT

-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
--   COMMENT='Outbound shipment orders: draft → on_the_way → completed';


-- ============================================================
-- Migration: 011_create_outbound_orders.sql
-- Description: Outbound shipment orders — 3 stage lifecycle: draft → on_the_way → completed
-- ============================================================

CREATE TABLE IF NOT EXISTS `outbound_orders` (
    `id`                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `company_id`            INT UNSIGNED     NOT NULL,
    `warehouse_id`          INT UNSIGNED     NOT NULL COMMENT 'Receiving warehouse',

    -- Human-readable reference (generated on confirm)
    `outbound_id`            VARCHAR(30)      NOT NULL
        COMMENT 'e.g. OB-2024-000001 — generated when draft is confirmed',

    -- Status lifecycle
    `status`                ENUM('draft','on_the_way','completed','cancelled')
                            NOT NULL DEFAULT 'draft',

    -- Shipping details (filled when confirming draft → on_the_way)
    `tracking_number`       VARCHAR(100)     NULL DEFAULT NULL,
    `purchase_currency`     VARCHAR(10)      NULL DEFAULT NULL COMMENT 'e.g. USD, MYR, SGD',
    `exchange_rate`         DECIMAL(15,6)    NULL DEFAULT NULL COMMENT 'Rate vs company base currency at time of order',
    `supplier_name`         VARCHAR(255)     NULL DEFAULT NULL,
    `supplier_reference`    VARCHAR(100)     NULL DEFAULT NULL COMMENT 'Supplier invoice / PO number',
    `receiving_warehouse_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Receiving warehouse name snapshot',
    `receiving_warehouse_address` TEXT NULL DEFAULT NULL COMMENT 'Receiving warehouse full address snapshot',
    `shipping_cost`         DECIMAL(15,2)    NULL DEFAULT NULL,
    `notes`                 TEXT             NULL DEFAULT NULL,

    -- Dates
    `estimated_arrival`     DATE             NULL DEFAULT NULL,
    `shipped_at`            DATETIME         NULL DEFAULT NULL COMMENT 'When status changed to on_the_way',
    `arrived_at`            DATETIME         NULL DEFAULT NULL COMMENT 'When status changed to completed',

    -- Manual outbound flag
    `is_manual`             TINYINT(1)       NOT NULL DEFAULT 0
        COMMENT '1 = created via manual receipt flow (skips draft/ship, directly completed)',

    `created_by`            INT UNSIGNED     NULL DEFAULT NULL,

    `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`            DATETIME         NULL DEFAULT NULL,

    PRIMARY KEY (`id`),

    UNIQUE KEY `uq_outbound_orders_outbound_id` (`company_id`, `outbound_id`),

    KEY `idx_outbound_company`           (`company_id`),
    KEY `idx_outbound_warehouse`         (`warehouse_id`),
    KEY `idx_outbound_status`            (`company_id`, `status`),
    KEY `idx_outbound_created`           (`company_id`, `created_at`),
    KEY `idx_outbound_tracking`          (`tracking_number`),
    KEY `idx_outbound_deleted`           (`deleted_at`),
    KEY `idx_outbound_is_manual`         (`company_id`, `is_manual`),

    CONSTRAINT `fk_outbound_company`
        FOREIGN KEY (`company_id`)   REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_outbound_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Outbound shipment orders: draft → on_the_way → completed';
