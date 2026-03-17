-- Migration: Create relational tables for plan features and limits
-- Single source of truth for features and limits

-- 1. Create feature_metadata table
CREATE TABLE IF NOT EXISTS feature_metadata (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'core',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create plan_features table
CREATE TABLE IF NOT EXISTS plan_features (
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plan_id, feature_code)
);

-- 3. Create plan_limits table
CREATE TABLE IF NOT EXISTS plan_limits (
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    limit_name VARCHAR(50) NOT NULL,
    limit_value INT NOT NULL DEFAULT 0, -- -1 for unlimited
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plan_id, limit_name)
);

-- 4. Initial seed for feature_metadata (based on existing feature codes)
INSERT INTO feature_metadata (code, name, category) VALUES
('radius_basic', 'Radius Basic', 'radius'),
('mikrotik_api_basic', 'Mikrotik API Basic', 'network'),
('wa_gateway_basic', 'WhatsApp Gateway Basic', 'whatsapp'),
('isolir_manual', 'Isolir Manual', 'billing'),
('addon_router', 'Add Router Addon', 'addon'),
('addon_user_packs', 'User Pack Addon', 'addon'),
('mikrotik_control_panel_advanced', 'Mikrotik Control Panel Advanced', 'network'),
('wa_gateway', 'WhatsApp Gateway Pro', 'whatsapp'),
('isolir_auto', 'Isolir Auto', 'billing'),
('rbac_employee', 'RBAC Employee', 'rbac'),
('rbac_client_reseller', 'RBAC Client/Reseller', 'rbac'),
('payment_gateway', 'Payment Gateway Integration', 'billing'),
('api_integration_partial', 'Partial API Integration', 'api'),
('api_integration_full', 'Full API Integration', 'api'),
('hcm_module', 'HCM Module', 'hr'),
('payment_reporting_advanced', 'Advanced Payment Reporting', 'billing'),
('dashboard_pendapatan', 'Income Dashboard', 'billing'),
('odp_maps', 'ODP Maps', 'network'),
('client_maps', 'Client Location Maps', 'network'),
('custom_login_page', 'Custom Login Page', 'branding'),
('custom_isolir_page', 'Custom Isolir Page', 'branding'),
('ai_agent_client_wa', 'AI Agent WhatsApp', 'ai'),
('settlement', 'Collector Settlement', 'billing'),
('service_packages', 'Service Packages (Voucher/PPPoE)', 'network'),
('*', 'All Features (Enterprise Wildcard)', 'system')
ON CONFLICT (code) DO NOTHING;

-- 5. Data Migration: Populate plan_features from JSONB
-- Extract array elements from features jsonb and insert into plan_features
INSERT INTO plan_features (plan_id, feature_code)
SELECT id, feature_code
FROM plans, jsonb_array_elements_text(features) AS feature_code
ON CONFLICT DO NOTHING;

-- 6. Data Migration: Populate plan_limits from JSONB
-- Extract keys and values from limits jsonb and insert into plan_limits
INSERT INTO plan_limits (plan_id, limit_name, limit_value)
SELECT id, limit_name, limit_value::int
FROM plans, jsonb_each_text(limits) AS l(limit_name, limit_value)
ON CONFLICT (plan_id, limit_name) DO UPDATE SET limit_value = EXCLUDED.limit_value;
