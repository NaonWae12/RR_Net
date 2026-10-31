-- Revert: Remove status tracking and inform interval from acs_device_tenants
DROP INDEX IF EXISTS idx_acs_device_tenants_status;

ALTER TABLE acs_device_tenants
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS online_at,
    DROP COLUMN IF EXISTS offline_at,
    DROP COLUMN IF EXISTS inform_interval;
