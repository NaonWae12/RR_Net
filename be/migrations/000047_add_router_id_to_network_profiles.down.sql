-- Remove router_id from network_profiles
DROP INDEX IF EXISTS idx_network_profiles_router_id;
ALTER TABLE network_profiles DROP COLUMN IF EXISTS router_id;
