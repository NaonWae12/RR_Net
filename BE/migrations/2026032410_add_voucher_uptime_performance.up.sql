-- Add denormalized uptime and usage tracking to vouchers for performance
ALTER TABLE vouchers ADD COLUMN total_uptime_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN total_bytes_used BIGINT NOT NULL DEFAULT 0;

-- Add max uptime limit to voucher packages for "Play/Pause" (Uptime-based) accounting
ALTER TABLE voucher_packages ADD COLUMN max_uptime_seconds INTEGER;

-- Create index for performance
CREATE INDEX idx_vouchers_uptime_usage ON vouchers(total_uptime_seconds, total_bytes_used);
