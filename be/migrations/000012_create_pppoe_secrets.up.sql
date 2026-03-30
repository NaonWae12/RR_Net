-- PPPoE secrets (user accounts)
CREATE TABLE IF NOT EXISTS pppoe_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    router_id UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES network_profiles(id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    service VARCHAR(50) DEFAULT 'pppoe',
    caller_id VARCHAR(50),
    remote_address VARCHAR(50),
    local_address VARCHAR(50),
    comment TEXT,
    is_disabled BOOLEAN NOT NULL DEFAULT false,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, username)
);

CREATE INDEX idx_pppoe_secrets_tenant_id ON pppoe_secrets(tenant_id);
CREATE INDEX idx_pppoe_secrets_client_id ON pppoe_secrets(client_id);
CREATE INDEX idx_pppoe_secrets_router_id ON pppoe_secrets(router_id);
CREATE INDEX idx_pppoe_secrets_username ON pppoe_secrets(username);
CREATE INDEX idx_pppoe_secrets_is_disabled ON pppoe_secrets(is_disabled);


