-- Migration: Create client_groups table + extend clients with group_id
-- Client groups are tenant-scoped labels to organize clients (rarely changed)

CREATE TABLE IF NOT EXISTS client_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_client_group_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_groups_tenant_id ON client_groups(tenant_id);

CREATE TRIGGER update_client_groups_updated_at
    BEFORE UPDATE ON client_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE client_groups IS 'Tenant-defined client groups (labels for organizing clients)';

-- Extend clients table with optional group_id
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES client_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_group_id ON clients(group_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_group_id ON clients(tenant_id, group_id);


