-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 004_create_pages_table
-- Description: Global sidebar navigation pages (key/sub/sub-sub structure)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `pages` (
    `id`         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `key`        VARCHAR(100)     NOT NULL COMMENT 'Unique snake_case page key e.g. dashboard, product_management',
    `label`      VARCHAR(150)     NULL     DEFAULT NULL COMMENT 'Optional display label — frontend can derive from key',
    `parent_id`  INT UNSIGNED     NULL     DEFAULT NULL COMMENT 'NULL = top-level. References pages.id for sub/sub-sub pages',
    `level`      TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 = top-level, 2 = sub, 3 = sub-sub',
    `has_sub`    TINYINT(1)       NOT NULL DEFAULT 0,
    `order`      SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Sort order within the same parent',
    `is_active`  TINYINT(1)       NOT NULL DEFAULT 1,
    `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    -- Unique key per page
    UNIQUE KEY `uq_pages_key` (`key`),

    -- Foreign key: self-referencing parent
    CONSTRAINT `fk_pages_parent`
        FOREIGN KEY (`parent_id`) REFERENCES `pages` (`id`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Indexes for tree traversal and filtering
    INDEX `idx_pages_parent_id` (`parent_id`),
    INDEX `idx_pages_level`     (`level`),
    INDEX `idx_pages_order`     (`order`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Global sidebar navigation page structure (shared across all companies)';


-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Full sidebar navigation structure
-- Matches the screenshots: Dashboard → Product → Inventory → Order →
--                          Warehouse → System Configuration
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Level 1: Top-level pages ──────────────────────────────────────────────────
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('dashboard',            'Dashboard',            NULL, 1, 0, 0),
('product_management',   'Product Management',   NULL, 1, 1, 1),
('inventory_management', 'Inventory Management', NULL, 1, 1, 2),
('order_management',     'Order Management',     NULL, 1, 1, 3),
('warehouse_management', 'Warehouse Management', NULL, 1, 0, 4),
('system_configuration', 'System Configuration', NULL, 1, 1, 5);


-- ── Level 2: Sub-pages ────────────────────────────────────────────────────────

-- Product Management → sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('product_list',  'Product List',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'product_management') AS t),  2, 0, 0),
('combine_sku',   'Combine SKU',   (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'product_management') AS t),  2, 0, 1);

-- Inventory Management → sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('merchant_sku',    'Merchant SKU',    (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 0, 0),
('sku_mapping',     'SKU Mapping',     (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 1, 1),
('inventory_list',  'Inventory List',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 0, 2),
('manual_inbound',  'Manual Inbound',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 0, 3),
('inbound',         'Inbound',         (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 1, 4),
('outbound_order',  'Outbound Order',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 0, 5),
('inventory_log',   'Inventory Log',   (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inventory_management') AS t), 2, 0, 6);

-- Order Management → sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('order_processing', 'Order Processing', (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_management') AS t), 2, 1, 0),
('manual_order',     'Manual Order',     (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_management') AS t), 2, 0, 1);

-- System Configuration → sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('store_authorization', 'Store Authorization', (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'system_configuration') AS t), 2, 0, 0),
('account_management',  'Account Management',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'system_configuration') AS t), 2, 1, 1);


-- ── Level 3: Sub-sub-pages ────────────────────────────────────────────────────

-- SKU Mapping → sub-sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('sku_mapping_by_product',  'By Product',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'sku_mapping') AS t), 3, 0, 0),
('sku_mapping_by_merchant', 'By Merchant', (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'sku_mapping') AS t), 3, 0, 1);

-- Inbound → sub-sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('inbound_draft',       'Draft',       (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inbound') AS t), 3, 0, 0),
('inbound_on_the_way',  'On The Way',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inbound') AS t), 3, 0, 1),
('inbound_complete',    'Complete',    (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'inbound') AS t), 3, 0, 2);

-- Order Processing → sub-sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('new_order',       'New Order',       (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 0),
('processed_order', 'Processed Order', (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 1),
('to_pickup_order', 'To Pickup Order', (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 2),
('shipped_order',   'Shipped Order',   (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 3),
('completed_order', 'Completed',       (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 4),
('all_order',       'All Order',       (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 5),
('canceled_order',  'Canceled Order',  (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_processing') AS t), 3, 0, 6);

-- Account Management → sub-sub
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`) VALUES
('sub_account',     'Sub Account',     (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'account_management') AS t), 3, 0, 0),
('role_management', 'Role Management', (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'account_management') AS t), 3, 0, 1);