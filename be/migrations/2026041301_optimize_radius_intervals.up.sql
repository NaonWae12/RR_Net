-- Optimize RADIUS accounting intervals for production stability
-- Change default from 1 minute (60s) to 5 minutes (300s)
ALTER TABLE routers ALTER COLUMN interim_interval SET DEFAULT 300;

-- Update existing routers that are still using the old aggressive 60s default
UPDATE routers 
SET interim_interval = 300, 
    updated_at = NOW() 
WHERE interim_interval = 60;

-- Ensure Tight Indices for voucher usage tracking
CREATE INDEX IF NOT EXISTS idx_radius_sessions_voucher_id_acct ON radius_sessions(voucher_id, acct_session_time, acct_input_octets, acct_output_octets);
