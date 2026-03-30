-- Add isolated column to vouchers table
ALTER TABLE vouchers ADD COLUMN isolated BOOLEAN NOT NULL DEFAULT false;

-- Add index for quick filtering of isolated vouchers
CREATE INDEX idx_vouchers_isolated ON vouchers(isolated) WHERE isolated = true;

-- Add comment
COMMENT ON COLUMN vouchers.isolated IS 'Whether the voucher user is currently isolated (blocked from internet access)';
