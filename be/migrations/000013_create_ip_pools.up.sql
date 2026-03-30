-- IP address pools
CREATE TABLE IF NOT EXISTS ip_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    router_id UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    ranges TEXT NOT NULL, -- e.g., "192.168.1.10-192.168.1.100"
    next_pool VARCHAR(100),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_ip_pools_tenant_id ON ip_pools(tenant_id);
CREATE INDEX idx_ip_pools_router_id ON ip_pools(router_id);


