-- Remove RADIUS-related fields from routers
DROP INDEX IF EXISTS idx_routers_nas_ip;

ALTER TABLE routers
    DROP COLUMN IF EXISTS radius_enabled,
    DROP COLUMN IF EXISTS radius_secret,
    DROP COLUMN IF EXISTS nas_ip;


