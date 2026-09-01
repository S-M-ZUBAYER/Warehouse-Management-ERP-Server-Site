-- ============================================================
-- Migration: 048_add_shipping_wallet_ledger_idempotency_index.sql
-- Description: Cleans duplicate Stripe wallet top-up credits and prevents the same provider/session reference from being credited twice.
-- ============================================================

CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_cswl_duplicate_topups` AS
SELECT
    ranked.`id`,
    ranked.`company_id`,
    ranked.`wallet_id`,
    ranked.`reference`,
    ranked.`amount_myr`,
    ranked.`keep_id`,
    ranked.`row_no`
FROM (
    SELECT
        l.`id`,
        l.`company_id`,
        l.`wallet_id`,
        l.`reference`,
        l.`amount_myr`,
        MIN(l.`id`) OVER (PARTITION BY l.`company_id`, l.`type`, l.`reference`, l.`status`) AS `keep_id`,
        ROW_NUMBER() OVER (PARTITION BY l.`company_id`, l.`type`, l.`reference`, l.`status` ORDER BY l.`id`) AS `row_no`,
        COUNT(*) OVER (PARTITION BY l.`company_id`, l.`type`, l.`reference`, l.`status`) AS `duplicate_count`
    FROM `company_shipping_wallet_ledger` l
    WHERE l.`type` = 'topup'
      AND l.`status` = 'succeeded'
      AND l.`reference` IS NOT NULL
) ranked
WHERE ranked.`duplicate_count` > 1;

CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_cswl_wallet_corrections` AS
SELECT
    d.`company_id`,
    d.`wallet_id`,
    SUM(d.`amount_myr`) AS `duplicate_amount_myr`
FROM `tmp_cswl_duplicate_topups` d
WHERE d.`row_no` > 1
GROUP BY d.`company_id`, d.`wallet_id`;

CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_cswl_wallet_correction_balances` AS
SELECT
    c.`company_id`,
    c.`wallet_id`,
    w.`balance_myr` AS `balance_before_myr`,
    c.`duplicate_amount_myr`,
    (w.`balance_myr` - c.`duplicate_amount_myr`) AS `balance_after_myr`
FROM `tmp_cswl_wallet_corrections` c
JOIN `company_shipping_wallets` w ON w.`id` = c.`wallet_id` AND w.`company_id` = c.`company_id`;

UPDATE `company_shipping_wallet_ledger` l
JOIN `tmp_cswl_duplicate_topups` d ON d.`id` = l.`id`
SET
    l.`status` = CONCAT('duplicate_voided_', l.`id`),
    l.`metadata` = JSON_OBJECT(
        'duplicateVoidedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
        'duplicateReason', 'Same Stripe checkout session was confirmed multiple times',
        'keptLedgerId', d.`keep_id`
    )
WHERE d.`row_no` > 1;

INSERT INTO `company_shipping_wallet_ledger` (
    `company_id`,
    `wallet_id`,
    `type`,
    `amount_myr`,
    `balance_before_myr`,
    `balance_after_myr`,
    `original_amount`,
    `original_currency`,
    `fx_rate_to_myr`,
    `provider`,
    `reference`,
    `status`,
    `metadata`,
    `created_at`
)
SELECT
    b.`company_id`,
    b.`wallet_id`,
    'correction',
    -b.`duplicate_amount_myr`,
    b.`balance_before_myr`,
    b.`balance_after_myr`,
    b.`duplicate_amount_myr`,
    'MYR',
    1,
    'stripe',
    CONCAT('duplicate-topup-correction:', b.`wallet_id`, ':', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s')),
    'succeeded',
    JSON_OBJECT('reason', 'Voided duplicate Manual Order shipping wallet Stripe session credits'),
    UTC_TIMESTAMP()
FROM `tmp_cswl_wallet_correction_balances` b
WHERE b.`duplicate_amount_myr` > 0;

UPDATE `company_shipping_wallets` w
JOIN `tmp_cswl_wallet_correction_balances` b ON b.`wallet_id` = w.`id` AND b.`company_id` = w.`company_id`
SET w.`balance_myr` = b.`balance_after_myr`
WHERE b.`duplicate_amount_myr` > 0;

SET @idx_exists := (
    SELECT COUNT(1)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'company_shipping_wallet_ledger'
      AND INDEX_NAME = 'uq_cswl_company_type_reference_status'
);

SET @add_idx_sql := IF(
    @idx_exists = 0,
    'ALTER TABLE `company_shipping_wallet_ledger` ADD UNIQUE KEY `uq_cswl_company_type_reference_status` (`company_id`, `type`, `reference`, `status`)',
    'SELECT 1'
);

PREPARE add_idx_stmt FROM @add_idx_sql;
EXECUTE add_idx_stmt;
DEALLOCATE PREPARE add_idx_stmt;

DROP TEMPORARY TABLE IF EXISTS `tmp_cswl_wallet_correction_balances`;
DROP TEMPORARY TABLE IF EXISTS `tmp_cswl_wallet_corrections`;
DROP TEMPORARY TABLE IF EXISTS `tmp_cswl_duplicate_topups`;
