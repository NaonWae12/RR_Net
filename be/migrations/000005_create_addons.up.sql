-- Migration: Create addons table
-- Add-on catalog for additional features/capacity

CREATE TABLE IF NOT EXISTS addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Pricing
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('one_time', 'monthly', 'yearly')),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    
    -- What it provides (limits boost or feature unlock)
    addon_type VARCHAR(20) NOT NULL CHECK (addon_type IN ('limit_boost', 'feature')),
    value JSONB NOT NULL DEFAULT '{}',  -- e.g., {"add_routers": 5} or {"feature": "custom_domain"}
    
    -- Availability
    is_active BOOLEAN NOT NULL DEFAULT true,
    available_for_plans JSONB DEFAULT '["basic", "pro", "business", "enterprise"]',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_addons_updated_at
    BEFORE UPDATE ON addons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default add-ons
INSERT INTO addons (code, name, description, price, billing_cycle, addon_type, value, available_for_plans) VALUES
('extra_router_5', 'Extra 5 Routers', 'Tambahan kapasitas 5 router', 50000, 'monthly', 'limit_boost', '{"add_routers": 5}', '["basic", "pro", "business"]'),
('extra_user_10', 'Extra 10 Users', 'Tambahan kapasitas 10 user', 30000, 'monthly', 'limit_boost', '{"add_users": 10}', '["basic", "pro", "business"]'),
('extra_client_100', 'Extra 100 Clients', 'Tambahan kapasitas 100 client', 75000, 'monthly', 'limit_boost', '{"add_clients": 100}', '["basic", "pro", "business"]'),
('extra_wa_500', 'Extra 500 WA Messages', 'Tambahan kuota 500 pesan WA/bulan', 25000, 'monthly', 'limit_boost', '{"add_wa_quota": 500}', '["pro", "business"]'),
('custom_domain', 'Custom Domain', 'Gunakan domain sendiri', 100000, 'monthly', 'feature', '{"feature": "custom_domain"}', '["pro", "business", "enterprise"]'),
('priority_support', 'Priority Support', 'Dukungan prioritas via WA/email', 200000, 'monthly', 'feature', '{"feature": "priority_support"}', '["basic", "pro", "business"]'),
('api_access', 'API Access', 'Akses REST API untuk integrasi', 150000, 'monthly', 'feature', '{"feature": "api_access"}', '["pro", "business"]');

COMMENT ON TABLE addons IS 'Available add-ons for tenant subscription';
COMMENT ON COLUMN addons.addon_type IS 'limit_boost = increases limits, feature = unlocks feature';
COMMENT ON COLUMN addons.value IS 'JSON defining what the addon provides';

