-- Migration: Create feature_toggles table
-- Global and per-tenant feature flags

CREATE TABLE IF NOT EXISTS feature_toggles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scope
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global toggle
    
    -- Toggle state
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Conditions (optional JSON for complex rules)
    conditions JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique per scope
    CONSTRAINT unique_feature_toggle UNIQUE (code, tenant_id)
);

CREATE INDEX idx_feature_toggles_code ON feature_toggles(code);
CREATE INDEX idx_feature_toggles_tenant_id ON feature_toggles(tenant_id);
CREATE INDEX idx_feature_toggles_enabled ON feature_toggles(is_enabled);

CREATE TRIGGER update_feature_toggles_updated_at
    BEFORE UPDATE ON feature_toggles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert global feature toggles (tenant_id = NULL means global)
INSERT INTO feature_toggles (code, name, description, tenant_id, is_enabled) VALUES
('maintenance_mode', 'Maintenance Mode', 'Enable platform-wide maintenance mode', NULL, false),
('new_billing_engine', 'New Billing Engine', 'Use new billing calculation engine', NULL, false),
('beta_maps_v2', 'Beta Maps V2', 'Enable new maps interface', NULL, false),
('wa_multi_provider', 'WA Multi Provider', 'Allow multiple WA providers per tenant', NULL, false),
('ai_assistant', 'AI Assistant', 'Enable AI-powered features', NULL, false);

COMMENT ON TABLE feature_toggles IS 'Feature flags for gradual rollout and A/B testing';
COMMENT ON COLUMN feature_toggles.tenant_id IS 'NULL for global toggles, set for tenant-specific overrides';
COMMENT ON COLUMN feature_toggles.conditions IS 'Optional JSON conditions for toggle (percentage rollout, etc)';

