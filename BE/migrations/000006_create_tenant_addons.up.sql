-- Migration: Create tenant_addons junction table
-- Tracks which addons each tenant has subscribed to

CREATE TABLE IF NOT EXISTS tenant_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE RESTRICT,
    
    -- Subscription details
    quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate active addons
    CONSTRAINT unique_active_addon UNIQUE (tenant_id, addon_id)
);

CREATE INDEX idx_tenant_addons_tenant_id ON tenant_addons(tenant_id);
CREATE INDEX idx_tenant_addons_addon_id ON tenant_addons(addon_id);
CREATE INDEX idx_tenant_addons_status ON tenant_addons(status);

CREATE TRIGGER update_tenant_addons_updated_at
    BEFORE UPDATE ON tenant_addons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tenant_addons IS 'Junction table for tenant add-on subscriptions';

