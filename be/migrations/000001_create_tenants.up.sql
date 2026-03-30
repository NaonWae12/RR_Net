-- Migration: Create tenants table
-- Multi-tenant SaaS core table

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,          -- subdomain identifier
    domain VARCHAR(255),                         -- custom domain (optional)
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'deleted')),
    
    -- Plan & Billing
    plan_id UUID,                                -- FK to plans (added later)
    billing_status VARCHAR(20) DEFAULT 'active' CHECK (billing_status IN ('active', 'overdue', 'suspended')),
    trial_ends_at TIMESTAMPTZ,
    
    -- Settings (JSON for flexibility)
    settings JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_plan_id ON tenants(plan_id);
CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tenants IS 'Multi-tenant organizations/companies using the SaaS platform';
COMMENT ON COLUMN tenants.slug IS 'Subdomain identifier (e.g., acme -> acme.rrnet.id)';
COMMENT ON COLUMN tenants.settings IS 'Tenant-specific settings as JSON';

