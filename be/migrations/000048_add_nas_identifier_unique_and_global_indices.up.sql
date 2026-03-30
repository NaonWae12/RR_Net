-- Add unique constraint to nas_identifier
ALTER TABLE routers ADD CONSTRAINT idx_routers_nas_identifier_unique UNIQUE (nas_identifier);

-- Add index for status and deleted_at to speed up global scans
CREATE INDEX IF NOT EXISTS idx_routers_global_scan ON routers(remote_access_port) WHERE deleted_at IS NULL;
