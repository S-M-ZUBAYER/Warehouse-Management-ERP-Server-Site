-- ============================================================
-- Migration: 046_update_billing_plan_feature_translations.sql
-- Description: Refresh pricing plan card names and feature translations
-- ============================================================

CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_billing_plan_name_seed` (
    `code` VARCHAR(40) NOT NULL PRIMARY KEY,
    `name_en` VARCHAR(100) NOT NULL,
    `name_zh` VARCHAR(100) NOT NULL,
    `name_fil` VARCHAR(100) NOT NULL,
    `name_id` VARCHAR(100) NOT NULL,
    `name_ms` VARCHAR(100) NOT NULL,
    `name_vi` VARCHAR(100) NOT NULL,
    `name_th` VARCHAR(100) NOT NULL
) ENGINE=Memory DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `tmp_billing_plan_name_seed`;

INSERT INTO `tmp_billing_plan_name_seed`
    (`code`, `name_en`, `name_zh`, `name_fil`, `name_id`, `name_ms`, `name_vi`, `name_th`)
VALUES
    ('free', 'Free', '免费', 'Libre', 'Gratis', 'Percuma', 'Miễn phí', 'ฟรี'),
    ('basic', 'Basic', '基础', 'Basic', 'Dasar', 'Asas', 'Cơ bản', 'พื้นฐาน'),
    ('standard', 'Standard', '标准', 'Standard', 'Standar', 'Standard', 'Tiêu chuẩn', 'มาตรฐาน'),
    ('pro', 'Pro', '专业', 'Pro', 'Pro', 'Pro', 'Pro', 'โปร'),
    ('ultimate', 'Ultimate', '旗舰', 'Ultimate', 'Ultimate', 'Ultimate', 'Ultimate', 'อัลติเมต');

INSERT INTO `billing_plan_translations` (`plan_id`, `language`, `display_name`, `description`)
SELECT `bp`.`id`, `seed`.`language`, `seed`.`display_name`, CONCAT(`bp`.`duration_days`, ' days store subscription')
FROM `billing_plans` AS `bp`
JOIN (
    SELECT `code`, 'en' AS `language`, `name_en` AS `display_name` FROM `tmp_billing_plan_name_seed`
    UNION ALL SELECT `code`, 'zh', `name_zh` FROM `tmp_billing_plan_name_seed`
    UNION ALL SELECT `code`, 'fil', `name_fil` FROM `tmp_billing_plan_name_seed`
    UNION ALL SELECT `code`, 'id', `name_id` FROM `tmp_billing_plan_name_seed`
    UNION ALL SELECT `code`, 'ms', `name_ms` FROM `tmp_billing_plan_name_seed`
    UNION ALL SELECT `code`, 'vi', `name_vi` FROM `tmp_billing_plan_name_seed`
    UNION ALL SELECT `code`, 'th', `name_th` FROM `tmp_billing_plan_name_seed`
) AS `seed` ON `seed`.`code` = `bp`.`code`
ON DUPLICATE KEY UPDATE
    `display_name` = VALUES(`display_name`),
    `description` = VALUES(`description`);

UPDATE `billing_plan_features`
SET `is_active` = 0
WHERE `feature_key` IN ('orders', 'fulfillment', 'bulk_processing');

INSERT INTO `billing_plan_features`
    (`plan_id`, `serial_no`, `feature_key`, `title`, `description`, `translations`, `is_active`)
SELECT
    `id`,
    1,
    'duration',
    CONCAT(`duration_days`, ' days subscription duration'),
    'Duration is configured from backend plan settings.',
    JSON_OBJECT(
        'en', JSON_OBJECT('title', CONCAT(`duration_days`, ' days subscription duration')),
        'zh', JSON_OBJECT('title', CONCAT(`duration_days`, ' 天订阅时长')),
        'fil', JSON_OBJECT('title', CONCAT(`duration_days`, ' araw na tagal ng subscription')),
        'id', JSON_OBJECT('title', CONCAT(`duration_days`, ' hari durasi langganan')),
        'ms', JSON_OBJECT('title', CONCAT(`duration_days`, ' hari tempoh langganan')),
        'vi', JSON_OBJECT('title', CONCAT(`duration_days`, ' ngày thời hạn đăng ký')),
        'th', JSON_OBJECT('title', CONCAT('ระยะเวลาสมัครสมาชิก ', `duration_days`, ' วัน'))
    ),
    1
FROM `billing_plans`
WHERE 1 = 1
ON DUPLICATE KEY UPDATE
    `serial_no` = VALUES(`serial_no`),
    `title` = VALUES(`title`),
    `description` = VALUES(`description`),
    `translations` = VALUES(`translations`),
    `is_active` = VALUES(`is_active`);

CREATE TEMPORARY TABLE IF NOT EXISTS `tmp_billing_plan_feature_seed` (
    `serial_no` INT UNSIGNED NOT NULL,
    `feature_key` VARCHAR(100) NOT NULL PRIMARY KEY,
    `title_en` VARCHAR(255) NOT NULL,
    `title_zh` VARCHAR(255) NOT NULL,
    `title_fil` VARCHAR(255) NOT NULL,
    `title_id` VARCHAR(255) NOT NULL,
    `title_ms` VARCHAR(255) NOT NULL,
    `title_vi` VARCHAR(255) NOT NULL,
    `title_th` VARCHAR(255) NOT NULL
) ENGINE=Memory DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `tmp_billing_plan_feature_seed`;

INSERT INTO `tmp_billing_plan_feature_seed`
    (`serial_no`, `feature_key`, `title_en`, `title_zh`, `title_fil`, `title_id`, `title_ms`, `title_vi`, `title_th`)
VALUES
    (2, 'marketplace_support', 'Support for Shopee & TikTok', '支持 Shopee 和 TikTok', 'Suporta sa Shopee at TikTok', 'Dukungan untuk Shopee & TikTok', 'Sokongan untuk Shopee & TikTok', 'Hỗ trợ Shopee & TikTok', 'รองรับ Shopee และ TikTok'),
    (3, 'unlimited_order_processing', 'Unlimited order processing', '无限订单处理', 'Walang limitasyong pagproseso ng order', 'Pemrosesan pesanan tanpa batas', 'Pemprosesan pesanan tanpa had', 'Xử lý đơn hàng không giới hạn', 'ประมวลผลคำสั่งซื้อไม่จำกัด'),
    (4, 'inventory_synchronisation', 'Inventory synchronisation', '库存同步', 'Pagsi-sync ng imbentaryo', 'Sinkronisasi inventaris', 'Penyegerakan inventori', 'Đồng bộ tồn kho', 'ซิงค์สินค้าคงคลัง'),
    (5, 'bulk_order_management', 'Bulk order management', '批量订单管理', 'Pamamahala ng maramihang order', 'Manajemen pesanan massal', 'Pengurusan pesanan pukal', 'Quản lý đơn hàng hàng loạt', 'จัดการคำสั่งซื้อแบบกลุ่ม'),
    (6, 'shipment_tracking', 'Shipment tracking', '物流追踪', 'Pagsubaybay ng shipment', 'Pelacakan pengiriman', 'Penjejakan penghantaran', 'Theo dõi lô hàng', 'ติดตามการจัดส่ง'),
    (7, 'support', 'Customer support available', '提供客户支持', 'Available ang customer support', 'Dukungan pelanggan tersedia', 'Sokongan pelanggan tersedia', 'Có hỗ trợ khách hàng', 'มีบริการสนับสนุนลูกค้า'),
    (8, 'free_mobile_app', 'Free Mobile app', '免费移动应用', 'Libreng mobile app', 'Aplikasi mobile gratis', 'Aplikasi mudah alih percuma', 'Ứng dụng di động miễn phí', 'แอปมือถือฟรี');

INSERT INTO `billing_plan_features`
    (`plan_id`, `serial_no`, `feature_key`, `title`, `description`, `translations`, `is_active`)
SELECT
    `bp`.`id`,
    `seed`.`serial_no`,
    `seed`.`feature_key`,
    `seed`.`title_en`,
    'Feature is configured from backend plan settings.',
    JSON_OBJECT(
        'en', JSON_OBJECT('title', `seed`.`title_en`),
        'zh', JSON_OBJECT('title', `seed`.`title_zh`),
        'fil', JSON_OBJECT('title', `seed`.`title_fil`),
        'id', JSON_OBJECT('title', `seed`.`title_id`),
        'ms', JSON_OBJECT('title', `seed`.`title_ms`),
        'vi', JSON_OBJECT('title', `seed`.`title_vi`),
        'th', JSON_OBJECT('title', `seed`.`title_th`)
    ),
    1
FROM `billing_plans` AS `bp`
CROSS JOIN `tmp_billing_plan_feature_seed` AS `seed`
WHERE 1 = 1
ON DUPLICATE KEY UPDATE
    `serial_no` = VALUES(`serial_no`),
    `title` = VALUES(`title`),
    `description` = VALUES(`description`),
    `translations` = VALUES(`translations`),
    `is_active` = VALUES(`is_active`);

DROP TEMPORARY TABLE IF EXISTS `tmp_billing_plan_feature_seed`;
DROP TEMPORARY TABLE IF EXISTS `tmp_billing_plan_name_seed`;
