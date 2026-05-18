-- ============================================================
-- Migration: 010_create_stock_ledger_entries.sql
-- Description: Immutable audit log of every stock movement.
--              Never update or delete rows — append only.
-- ============================================================

CREATE TABLE IF NOT EXISTS `stock_ledger_entries` (
    `id`                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`            INT UNSIGNED     NOT NULL,
    `merchant_sku_id`       INT UNSIGNED     NOT NULL,
    `warehouse_id`          INT UNSIGNED     NOT NULL,
    `sku_warehouse_stock_id` INT UNSIGNED    NOT NULL,

    -- What happened
    `movement_type`         ENUM(
        'inbound_receipt',      -- goods received at warehouse
        'sale_deduction',       -- sold on platform
        'manual_adjustment',    -- admin correction
        'return',               -- customer return adds back
        'write_off',            -- damaged/lost goods
        'transfer_out',         -- moved to another warehouse
        'transfer_in'           -- received from another warehouse
    ) NOT NULL,

    -- Signed delta: positive = stock increase, negative = decrease
    `quantity_delta`        INT              NOT NULL,

    -- Snapshot of qty_on_hand AFTER this movement was applied
    `qty_on_hand_after`     INT              NOT NULL,

    -- What caused this movement (polymorphic reference)
    `reference_type`        VARCHAR(50)      NOT NULL
        COMMENT 'e.g. inbound_order, platform_order, manual',
    `reference_id`          VARCHAR(100)     NOT NULL
        COMMENT 'ID of the inbound order, platform order ID, etc.',

    -- Optional note
    `notes`                 VARCHAR(500)     NULL DEFAULT NULL,
    `created_by`            INT UNSIGNED     NULL DEFAULT NULL,
    `created_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    KEY `idx_sle_sku_warehouse`    (`merchant_sku_id`, `warehouse_id`),
    KEY `idx_sle_stock_id`         (`sku_warehouse_stock_id`),
    KEY `idx_sle_company_created`  (`company_id`, `created_at`),
    KEY `idx_sle_reference`        (`reference_type`, `reference_id`),
    KEY `idx_sle_movement_type`    (`movement_type`),

    -- Partition-friendly: order by created_at DESC for audit queries
    KEY `idx_sle_created_at`       (`created_at`),

    CONSTRAINT `fk_sle_company`
        FOREIGN KEY (`company_id`)             REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sle_merchant_sku`
        FOREIGN KEY (`merchant_sku_id`)        REFERENCES `merchant_skus` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sle_warehouse`
        FOREIGN KEY (`warehouse_id`)           REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sle_sku_warehouse_stock`
        FOREIGN KEY (`sku_warehouse_stock_id`) REFERENCES `sku_warehouse_stock` (`id`) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable append-only audit log of all stock movements — never delete or update rows';