-- ============================================================
-- Migration: 015_create_order_sale_lines.sql
-- Description: Records platform sale events that triggered stock deductions.
--              Idempotency guard: platform_order_id is unique per mapping.
-- ============================================================

CREATE TABLE IF NOT EXISTS `order_sale_lines` (
    `id`                      BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `company_id`              INT UNSIGNED     NOT NULL,
    `platform_sku_mapping_id` INT UNSIGNED     NOT NULL,

    -- Platform order reference
    `platform_order_id`       VARCHAR(100)     NOT NULL,
    `platform_order_item_id`  VARCHAR(100)     NULL DEFAULT NULL,

    `quantity_sold`           INT UNSIGNED     NOT NULL,

    -- Deduction tracking (idempotency guard)
    `deducted`                TINYINT(1)       NOT NULL DEFAULT 0
        COMMENT '1 = stock deduction already applied — prevents double deduction',
    `deducted_at`             DATETIME         NULL DEFAULT NULL,

    -- Financial snapshot at time of sale
    `sale_price`              DECIMAL(15,2)    NULL DEFAULT NULL,
    `currency`                VARCHAR(10)      NULL DEFAULT NULL,

    `sold_at`                 DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`              DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- Idempotency: same platform order item cannot be processed twice for same mapping
    UNIQUE KEY `uq_osl_order_mapping` (`platform_sku_mapping_id`, `platform_order_id`, `platform_order_item_id`),

    KEY `idx_osl_company`             (`company_id`),
    KEY `idx_osl_mapping`             (`platform_sku_mapping_id`),
    KEY `idx_osl_platform_order`      (`platform_order_id`),
    KEY `idx_osl_deducted`            (`deducted`),
    KEY `idx_osl_sold_at`             (`sold_at`),

    CONSTRAINT `fk_osl_company`
        FOREIGN KEY (`company_id`)              REFERENCES `companies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_osl_mapping`
        FOREIGN KEY (`platform_sku_mapping_id`) REFERENCES `platform_sku_mappings` (`id`) ON DELETE CASCADE,

    CONSTRAINT `chk_osl_qty` CHECK (`quantity_sold` > 0)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Platform sale events — used for idempotent stock deduction; one row per sold item';