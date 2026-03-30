-- Migration: Create roles table
-- RBAC system with 8 predefined roles per ROLE_CAPABILITY_SPEC

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,            -- super_admin, owner, admin, hr, finance, technician, collector, client
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT true,     -- system roles cannot be deleted
    permissions JSONB DEFAULT '[]',              -- array of permission codes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert predefined system roles
INSERT INTO roles (code, name, description, is_system, permissions) VALUES
    ('super_admin', 'Super Admin', 'Platform-level administrator with full access to all tenants', true, '["*"]'),
    ('owner', 'Owner', 'Tenant owner with full control over their organization', true, '["tenant:*", "user:*", "billing:*", "network:*", "maps:*", "hr:*", "collector:*", "technician:*", "client:*", "wa:*", "addon:*", "report:*"]'),
    ('admin', 'Admin', 'Tenant administrator with delegated management rights', true, '["user:read", "user:create", "user:update", "network:*", "maps:*", "client:*", "wa:read", "wa:send", "report:read"]'),
    ('hr', 'HR', 'Human resources manager for employee management', true, '["hr:*", "user:read", "report:hr"]'),
    ('finance', 'Finance', 'Financial operations and billing management', true, '["billing:*", "collector:read", "report:finance", "client:read"]'),
    ('technician', 'Technician', 'Field technician for network maintenance', true, '["technician:*", "maps:read", "client:read", "network:read"]'),
    ('collector', 'Collector', 'Payment collector for cash-based billing', true, '["collector:*", "client:read", "billing:collect"]'),
    ('client', 'Client', 'End-user/customer of the tenant', true, '["client:self", "billing:self", "wa:receive"]');

COMMENT ON TABLE roles IS 'System and custom roles for RBAC';
COMMENT ON COLUMN roles.code IS 'Unique role identifier used in code';
COMMENT ON COLUMN roles.permissions IS 'JSON array of permission codes (resource:action format)';

