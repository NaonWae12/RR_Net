-- Migration: Create clients table
-- End-user customers of each tenant (ISP subscribers)

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Optional login account
    
    -- Client info
    client_code VARCHAR(50) NOT NULL,           -- Tenant-specific customer ID
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    
    -- Location (for maps)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    odp_id UUID,                                -- FK to ODPs (added later)
    
    -- Service
    service_plan VARCHAR(100),                  -- Tenant's service package name
    speed_profile VARCHAR(100),                 -- e.g., "10Mbps/5Mbps"
    monthly_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    billing_date INT CHECK (billing_date >= 1 AND billing_date <= 28),  -- Day of month
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'isolir', 'suspended', 'terminated')),
    isolir_reason TEXT,
    isolir_at TIMESTAMPTZ,
    
    -- Network
    pppoe_username VARCHAR(100),
    ip_address INET,
    mac_address MACADDR,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Unique client code per tenant
    CONSTRAINT unique_client_code_per_tenant UNIQUE (tenant_id, client_code)
);

-- Indexes
CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_odp_id ON clients(odp_id);
CREATE INDEX idx_clients_pppoe ON clients(pppoe_username);
CREATE INDEX idx_clients_deleted_at ON clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_location ON clients(latitude, longitude) WHERE latitude IS NOT NULL;

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE clients IS 'End-user customers/subscribers of each tenant ISP';
COMMENT ON COLUMN clients.client_code IS 'Tenant-specific customer identifier';
COMMENT ON COLUMN clients.odp_id IS 'Reference to ODP node in network topology';
COMMENT ON COLUMN clients.status IS 'active=normal, isolir=suspended for payment, suspended=admin action, terminated=cancelled';

