-- Rollback: Remove rate_limit_mode field from voucher_packages table

DROP INDEX IF EXISTS idx_voucher_packages_rate_limit_mode;
ALTER TABLE voucher_packages DROP CONSTRAINT IF EXISTS valid_rate_limit_mode;
ALTER TABLE voucher_packages DROP COLUMN IF EXISTS rate_limit_mode;
