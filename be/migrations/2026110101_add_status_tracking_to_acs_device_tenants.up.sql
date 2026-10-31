-- Migration: Add status tracking and inform interval to acs_device_tenants
ALTER TABLE acs_device_tenants
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'offline',
    ADD COLUMN IF NOT EXISTS online_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS offline_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inform_interval INT NOT NULL DEFAULT 300;

CREATE INDEX IF NOT EXISTS idx_acs_device_tenants_status ON acs_device_tenants(status);
