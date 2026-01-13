-- Migration: Create service_packages table + extend clients for new service model
-- Service packages represent sellable ISP packages (PPPoE monthly or Lite per-device)

CREATE TABLE IF NOT EXISTS service_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Display
    name VARCHAR(255) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('regular', 'business', 'enterprise', 'lite')),

    -- Pricing model
    pricing_model VARCHAR(20) NOT NULL CHECK (pricing_model IN ('flat_monthly', 'per_device')),
    price_monthly DECIMAL(12, 2) NOT NULL DEFAULT 0,
    price_per_device DECIMAL(12, 2) NOT NULL DEFAULT 0,
    billing_day_default INT CHECK (billing_day_default IS NULL OR (billing_day_default >= 1 AND billing_day_default <= 28)),

    -- Network
    network_profile_id UUID NOT NULL REFERENCES network_profiles(id) ON DELETE RESTRICT,

    -- Status & metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT unique_service_package_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX idx_service_packages_tenant_id ON service_packages(tenant_id);
CREATE INDEX idx_service_packages_category ON service_packages(category);
CREATE INDEX idx_service_packages_is_active ON service_packages(is_active);
CREATE INDEX idx_service_packages_network_profile_id ON service_packages(network_profile_id);
CREATE INDEX idx_service_packages_deleted_at ON service_packages(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER update_service_packages_updated_at
    BEFORE UPDATE ON service_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE service_packages IS 'Tenant-defined service packages (PPPoE monthly or Lite per-device)';
COMMENT ON COLUMN service_packages.pricing_model IS 'flat_monthly for PPPoE, per_device for Lite';

-- Extend clients table for new service model
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'regular'
        CHECK (category IN ('regular', 'business', 'enterprise', 'lite')),
    ADD COLUMN IF NOT EXISTS service_package_id UUID REFERENCES service_packages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS device_count INT CHECK (device_count IS NULL OR device_count >= 1),
    ADD COLUMN IF NOT EXISTS pppoe_password_enc TEXT,
    ADD COLUMN IF NOT EXISTS pppoe_password_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);
CREATE INDEX IF NOT EXISTS idx_clients_service_package_id ON clients(service_package_id);


