ALTER TABLE return_orders
    ADD COLUMN local_return_tracking_number VARCHAR(150) NULL AFTER return_tracking_number,
    ADD KEY idx_return_orders_local_tracking (company_id, local_return_tracking_number);
