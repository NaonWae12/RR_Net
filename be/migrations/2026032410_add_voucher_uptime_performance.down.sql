DROP INDEX IF EXISTS idx_vouchers_uptime_usage;
ALTER TABLE voucher_packages DROP COLUMN IF EXISTS max_uptime_seconds;
ALTER TABLE vouchers DROP COLUMN IF EXISTS total_bytes_used;
ALTER TABLE vouchers DROP COLUMN IF EXISTS total_uptime_seconds;
