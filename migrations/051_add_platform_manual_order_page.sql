-- Migration: 051_add_platform_manual_order_page.sql
-- Adds Platform Manual Order as its own Order Management permission page
-- and backfills existing role permission JSON safely.

INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`, `is_active`, `created_at`, `updated_at`)
SELECT
    'platform_manual_order',
    'Platform Manual Order',
    p.id,
    2,
    0,
    2,
    1,
    NOW(),
    NOW()
FROM `pages` p
WHERE p.`key` = 'order_management'
  AND NOT EXISTS (
      SELECT 1
      FROM `pages` existing
      WHERE existing.`key` = 'platform_manual_order'
  );

UPDATE `pages`
SET
    `label` = 'Platform Manual Order',
    `parent_id` = (SELECT id FROM (SELECT id FROM `pages` WHERE `key` = 'order_management') parent_page),
    `level` = 2,
    `has_sub` = 0,
    `order` = 2,
    `is_active` = 1
WHERE `key` = 'platform_manual_order';

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
    '$.order_management',
    CASE
        WHEN JSON_CONTAINS_PATH(`permissions`, 'one', '$.order_management') = 1
             AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(`permissions`, '$.order_management'))) IN ('true', '1')
            THEN JSON_OBJECT('access', JSON_EXTRACT('true', '$'), 'sub', JSON_OBJECT())
        ELSE JSON_OBJECT('access', JSON_EXTRACT('false', '$'), 'sub', JSON_OBJECT())
    END
)
WHERE COALESCE(JSON_CONTAINS_PATH(`permissions`, 'one', '$.order_management'), 0) = 0
   OR COALESCE(JSON_TYPE(JSON_EXTRACT(`permissions`, '$.order_management')), 'NULL') <> 'OBJECT';

UPDATE `roles`
SET `permissions` = JSON_SET(
    `permissions`,
    '$.order_management.sub',
    COALESCE(
        JSON_EXTRACT(`permissions`, '$.order_management.sub'),
        JSON_OBJECT()
    )
)
WHERE COALESCE(JSON_CONTAINS_PATH(`permissions`, 'one', '$.order_management.sub'), 0) = 0
   OR COALESCE(JSON_TYPE(JSON_EXTRACT(`permissions`, '$.order_management.sub')), 'NULL') <> 'OBJECT';

UPDATE `roles`
SET `permissions` = JSON_SET(
    `permissions`,
    '$.order_management.sub.platform_manual_order',
    CASE
        WHEN JSON_CONTAINS_PATH(`permissions`, 'one', '$.order_management.sub.manual_order') = 1
            THEN JSON_EXTRACT(`permissions`, '$.order_management.sub.manual_order')
        ELSE JSON_EXTRACT('false', '$')
    END
)
WHERE COALESCE(JSON_CONTAINS_PATH(`permissions`, 'one', '$.order_management.sub.platform_manual_order'), 0) = 0;
