-- Revert RADIUS accounting intervals
ALTER TABLE routers ALTER COLUMN interim_interval SET DEFAULT 60;

UPDATE routers 
SET interim_interval = 60, 
    updated_at = NOW() 
WHERE interim_interval = 300;

DROP INDEX IF EXISTS idx_radius_sessions_voucher_id_acct;
