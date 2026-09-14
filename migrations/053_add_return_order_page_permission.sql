-- Add the missing page entry without modifying any saved role permissions.
-- Run against an existing database; 005 is only the fresh-install seed.
INSERT INTO `pages` (`key`, `label`, `parent_id`, `level`, `has_sub`, `order`, `is_active`, `created_at`, `updated_at`)
SELECT 'return_order', 'Return Order', parent.`id`, 3, 0, 6, 1, NOW(), NOW()
FROM `pages` AS parent
WHERE parent.`key` = 'order_processing'
  AND NOT EXISTS (SELECT 1 FROM `pages` AS existing WHERE existing.`key` = 'return_order');

UPDATE `pages` AS canceled
JOIN `pages` AS returned ON returned.`parent_id` = canceled.`parent_id`
SET canceled.`order` = 7
WHERE canceled.`key` = 'canceled_order'
  AND canceled.`order` = 6
  AND returned.`key` = 'return_order'
  AND returned.`order` = 6;
