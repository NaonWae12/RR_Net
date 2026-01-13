-- Migration: Create plans table
-- SaaS pricing plans (Basic, Pro, Business, Enterprise)

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,            -- basic, pro, business, enterprise
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Pricing
    price_monthly DECIMAL(12, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(12, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    
    -- Limits (per feature_plan.md)
    limits JSONB NOT NULL DEFAULT '{
        "max_routers": 1,
        "max_users": 5,
        "max_vouchers": 100,
        "max_odc": 0,
        "max_odp": 0,
        "max_clients": 50,
        "wa_quota_monthly": 100
    }',
    
    -- Feature flags included in plan
    features JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,     -- show in pricing page
    sort_order INT NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans per feature_plan.md
INSERT INTO plans (code, name, description, price_monthly, limits, features, sort_order) VALUES
(
    'basic',
    'Basic',
    'Untuk ISP kecil yang baru memulai',
    150000,
    '{"max_routers": 2, "max_users": 250, "max_vouchers": 15000, "max_odc": 0, "max_odp": 0, "max_clients": 250, "max_client_maps": 0, "rbac_client_reseller": 0, "wa_quota_monthly": 100}',
    '["radius_basic", "mikrotik_api_basic", "wa_gateway_basic", "isolir_manual", "addon_router", "addon_user_packs"]',
    1
),
(
    'pro',
    'Pro',
    'Untuk ISP berkembang dengan kebutuhan lebih',
    400000,
    '{"max_routers": 5, "max_users": 1000, "max_vouchers": 35000, "max_odc": 0, "max_odp": 0, "max_clients": 1000, "max_client_maps": 0, "rbac_client_reseller": 70, "wa_quota_monthly": 500}',
    '["radius_basic", "mikrotik_api_basic", "mikrotik_control_panel_advanced", "wa_gateway", "isolir_manual", "isolir_auto", "rbac_employee", "rbac_client_reseller", "payment_gateway", "api_integration_partial", "hcm_module", "payment_reporting_advanced", "dashboard_pendapatan", "addon_router", "addon_user_packs"]',
    2
),
(
    'business',
    'Business',
    'Untuk ISP menengah dengan tim lengkap',
    950000,
    '{"max_routers": 10, "max_users": 5000, "max_vouchers": -1, "max_odc": 100, "max_odp": 600, "max_clients": 5000, "max_client_maps": 600, "rbac_client_reseller": -1, "wa_quota_monthly": -1}',
    '["radius_basic", "mikrotik_api_basic", "mikrotik_control_panel_advanced", "wa_gateway", "isolir_manual", "isolir_auto", "rbac_employee", "rbac_client_reseller", "odp_maps", "client_maps", "payment_gateway", "api_integration_full", "hcm_module", "payment_reporting_advanced", "dashboard_pendapatan", "custom_login_page", "custom_isolir_page", "ai_agent_client_wa", "addon_router", "addon_user_packs"]',
    3
),
(
    'enterprise',
    'Enterprise',
    'Untuk ISP besar dengan kebutuhan kustom',
    2000000,
    '{"max_routers": -1, "max_users": -1, "max_vouchers": -1, "max_odc": -1, "max_odp": -1, "max_clients": -1, "max_client_maps": -1, "rbac_client_reseller": -1, "wa_quota_monthly": -1}',
    '["*"]',
    4
);

COMMENT ON TABLE plans IS 'SaaS subscription plans with limits and features';
COMMENT ON COLUMN plans.limits IS 'JSON object with numeric limits (-1 = unlimited)';
COMMENT ON COLUMN plans.features IS 'JSON array of feature codes included in plan';

