-- Add expiration_mode to voucher packages to control "Play/Pause" vs "Wall-Clock"
ALTER TABLE voucher_packages ADD COLUMN expiration_mode VARCHAR(20) NOT NULL DEFAULT 'wall_clock';

-- expiration_mode values:
-- 'wall_clock': Timer runs continuously from first login (Standard MikroTik)
-- 'uptime_limit': Timer only runs when user is connected (Play/Pause)

-- Ensure max_uptime_seconds is set for uptime_limit mode
COMMENT ON COLUMN voucher_packages.max_uptime_seconds IS 'Used when expiration_mode is uptime_limit';
