-- Migration: Create acs_device_tenants table for multi-tenant ONT management
CREATE TABLE IF NOT EXISTS acs_device_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255),
    label VARCHAR(255),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_acs_device_id UNIQUE (device_id)
);

CREATE INDEX IF NOT EXISTS idx_acs_device_tenants_tenant_id ON acs_device_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_acs_device_tenants_device_id ON acs_device_tenants(device_id);
CREATE INDEX IF NOT EXISTS idx_acs_device_tenants_serial_number ON acs_device_tenants(serial_number);
CREATE INDEX IF NOT EXISTS idx_acs_device_tenants_client_id ON acs_device_tenants(client_id);
