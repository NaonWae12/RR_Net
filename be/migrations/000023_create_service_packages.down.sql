DROP INDEX IF EXISTS idx_clients_service_package_id;
DROP INDEX IF EXISTS idx_clients_category;

ALTER TABLE clients
    DROP COLUMN IF EXISTS pppoe_password_updated_at,
    DROP COLUMN IF EXISTS pppoe_password_enc,
    DROP COLUMN IF EXISTS device_count,
    DROP COLUMN IF EXISTS service_package_id,
    DROP COLUMN IF EXISTS category;

DROP TRIGGER IF EXISTS update_service_packages_updated_at ON service_packages;

DROP INDEX IF EXISTS idx_service_packages_deleted_at;
DROP INDEX IF EXISTS idx_service_packages_network_profile_id;
DROP INDEX IF EXISTS idx_service_packages_is_active;
DROP INDEX IF EXISTS idx_service_packages_category;
DROP INDEX IF EXISTS idx_service_packages_tenant_id;

DROP TABLE IF EXISTS service_packages;


