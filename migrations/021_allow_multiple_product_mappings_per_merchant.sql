-- Allow one merchant SKU to map to multiple platform product SKU rows in the same store.
-- Required for selecting one/multiple store product variants during SKU mapping.

SET @idx := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'platform_sku_mappings'
      AND index_name = 'uq_psm_store_merchant'
);

SET @sql := IF(@idx > 0,
    'ALTER TABLE platform_sku_mappings DROP INDEX uq_psm_store_merchant',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE INDEX idx_psm_store_merchant ON platform_sku_mappings (platform_store_id, merchant_sku_id);
