-- Rollback: Drop tenant_addons table
DROP TRIGGER IF EXISTS update_tenant_addons_updated_at ON tenant_addons;
DROP TABLE IF EXISTS tenant_addons;

