-- Remove isolated column from vouchers table
DROP INDEX IF EXISTS idx_vouchers_isolated;
ALTER TABLE vouchers DROP COLUMN IF EXISTS isolated;
