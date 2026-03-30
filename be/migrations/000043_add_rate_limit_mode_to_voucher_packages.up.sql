-- Migration: Add rate_limit_mode field to voucher_packages table
-- Supports two modes: 'full_radius' (rate limit via RADIUS) and 'radius_auth_only' (rate limit via MikroTik Hotspot profiles)

ALTER TABLE voucher_packages
ADD COLUMN IF NOT EXISTS rate_limit_mode VARCHAR(20) NOT NULL DEFAULT 'radius_auth_only';

-- Add constraint to ensure valid mode values
ALTER TABLE voucher_packages
ADD CONSTRAINT valid_rate_limit_mode CHECK (rate_limit_mode IN ('full_radius', 'radius_auth_only'));

-- Add index for filtering by mode
CREATE INDEX IF NOT EXISTS idx_voucher_packages_rate_limit_mode ON voucher_packages(rate_limit_mode);

-- Update existing packages to default mode (radius_auth_only)
UPDATE voucher_packages
SET rate_limit_mode = 'radius_auth_only'
WHERE rate_limit_mode IS NULL OR rate_limit_mode = '';

COMMENT ON COLUMN voucher_packages.rate_limit_mode IS 'Rate limiting mode: full_radius (via RADIUS attributes) or radius_auth_only (via MikroTik Hotspot profiles)';
