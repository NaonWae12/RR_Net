DROP INDEX IF EXISTS idx_asset_logs_created_at;
DROP INDEX IF EXISTS idx_asset_logs_tenant_id;
DROP INDEX IF EXISTS idx_asset_logs_instance_id;
DROP INDEX IF EXISTS idx_asset_instances_status;
DROP INDEX IF EXISTS idx_asset_instances_tenant_id;
DROP INDEX IF EXISTS idx_asset_instances_asset_id;
DROP INDEX IF EXISTS idx_assets_code;
DROP INDEX IF EXISTS idx_assets_tenant_id;

DROP TABLE IF EXISTS asset_logs;
DROP TABLE IF EXISTS asset_instances;
DROP TABLE IF EXISTS assets;
