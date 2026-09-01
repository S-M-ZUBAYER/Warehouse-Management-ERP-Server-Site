INSERT INTO `billing_plan_prices` (`plan_id`, `country`, `currency`, `amount`, `compare_amount`, `is_available`)
SELECT `id`, 'CN', 'CNY',
    CASE `code` WHEN 'free' THEN 0 WHEN 'basic' THEN 22 WHEN 'standard' THEN 36 WHEN 'pro' THEN 65 WHEN 'ultimate' THEN 116 ELSE 0 END,
    NULL,
    1
FROM `billing_plans`
ON DUPLICATE KEY UPDATE
    `amount` = VALUES(`amount`),
    `compare_amount` = VALUES(`compare_amount`),
    `is_available` = VALUES(`is_available`);
