-- Remove unique constraint and indices
ALTER TABLE routers DROP CONSTRAINT IF EXISTS idx_routers_nas_identifier_unique;
DROP INDEX IF EXISTS idx_routers_global_scan;
