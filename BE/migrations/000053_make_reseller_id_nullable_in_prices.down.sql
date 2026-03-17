-- Revert NULLable reseller_id
-- Note: This might fail if there are rows with NULL reseller_id
DELETE FROM reseller_prices WHERE reseller_id IS NULL;

ALTER TABLE reseller_prices ALTER COLUMN reseller_id SET NOT NULL;

DROP INDEX idx_reseller_prices_global_package;
DROP INDEX idx_reseller_prices_reseller_package;

ALTER TABLE reseller_prices ADD CONSTRAINT unique_reseller_package_price UNIQUE (reseller_id, voucher_package_id);
