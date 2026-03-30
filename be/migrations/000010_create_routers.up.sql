-- Network routers table
CREATE TABLE IF NOT EXISTS routers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'mikrotik',
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    api_port INTEGER DEFAULT 8728,
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMPTZ,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_router_type CHECK (type IN ('mikrotik', 'cisco', 'ubiquiti', 'other')),
    CONSTRAINT valid_router_status CHECK (status IN ('online', 'offline', 'maintenance'))
);

-- Ensure only one default router per tenant
CREATE UNIQUE INDEX idx_routers_default_per_tenant 
    ON routers (tenant_id) 
    WHERE is_default = true;

CREATE INDEX idx_routers_tenant_id ON routers(tenant_id);
CREATE INDEX idx_routers_status ON routers(status);


