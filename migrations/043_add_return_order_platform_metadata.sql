ALTER TABLE return_orders
    ADD COLUMN platform_created_at DATETIME NULL AFTER order_number,
    ADD COLUMN platform_updated_at DATETIME NULL AFTER platform_created_at,
    ADD COLUMN buyer_username VARCHAR(255) NULL AFTER platform_updated_at,
    ADD COLUMN buyer_email VARCHAR(255) NULL AFTER buyer_username,
    ADD COLUMN buyer_portrait_url TEXT NULL AFTER buyer_email,
    ADD COLUMN return_images_json JSON NULL AFTER buyer_portrait_url,
    ADD KEY idx_return_orders_platform_created (company_id, platform_created_at),
    ADD KEY idx_return_orders_platform_updated (company_id, platform_updated_at);
