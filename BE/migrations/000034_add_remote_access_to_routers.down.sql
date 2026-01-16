-- Remove Remote Access fields from routers table
ALTER TABLE routers DROP COLUMN IF EXISTS remote_access_enabled;
ALTER TABLE routers DROP COLUMN IF EXISTS remote_access_port;
