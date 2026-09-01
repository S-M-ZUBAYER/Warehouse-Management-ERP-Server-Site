-- Migration: 052_add_contact_page_permission
-- Description: Add public Contact page to role permissions and page list.

INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`, `is_active`, `created_at`, `updated_at`)
SELECT 'contact', 'Contact', NULL, 1, 0, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM `pages` existing
    WHERE existing.`key` = 'contact'
);

UPDATE `pages`
SET `label` = 'Contact',
    `parent_id` = NULL,
    `level` = 1,
    `has_sub` = 0,
    `order` = 1,
    `is_active` = 1,
    `updated_at` = NOW()
WHERE `key` = 'contact';

UPDATE `pages` SET `order` = 2, `updated_at` = NOW() WHERE `key` = 'product_management' AND `order` < 2;
UPDATE `pages` SET `order` = 3, `updated_at` = NOW() WHERE `key` = 'inventory_management' AND `order` < 3;
UPDATE `pages` SET `order` = 4, `updated_at` = NOW() WHERE `key` = 'order_management' AND `order` < 4;
UPDATE `pages` SET `order` = 5, `updated_at` = NOW() WHERE `key` = 'warehouse_management' AND `order` < 5;
UPDATE `pages` SET `order` = 6, `updated_at` = NOW() WHERE `key` = 'system_configuration' AND `order` < 6;

UPDATE `roles`
SET `permissions` = CASE
    WHEN JSON_VALID(JSON_UNQUOTE(`permissions`)) = 1
        THEN JSON_EXTRACT(JSON_UNQUOTE(`permissions`), '$')
    ELSE JSON_OBJECT()
END
WHERE JSON_TYPE(`permissions`) = 'STRING';

UPDATE `roles`
SET `permissions` = COALESCE(`permissions`, JSON_OBJECT())
WHERE `permissions` IS NULL
   OR COALESCE(JSON_TYPE(`permissions`), 'NULL') <> 'OBJECT';

UPDATE `roles`
SET `permissions` = JSON_SET(
    `permissions`,
    '$.contact',
    JSON_OBJECT('access', JSON_EXTRACT('true', '$'))
)
WHERE COALESCE(JSON_CONTAINS_PATH(`permissions`, 'one', '$.contact'), 0) = 0
   OR COALESCE(JSON_TYPE(JSON_EXTRACT(`permissions`, '$.contact')), 'NULL') <> 'OBJECT';

UPDATE `roles`
SET `permissions` = JSON_SET(
    `permissions`,
    '$.contact.access',
    JSON_EXTRACT('true', '$')
);
