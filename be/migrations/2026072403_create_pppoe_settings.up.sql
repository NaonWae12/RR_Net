CREATE TABLE IF NOT EXISTS pppoe_ip_settings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    router_id      UUID REFERENCES routers(id) ON DELETE CASCADE,
    local_address  VARCHAR(50) NOT NULL DEFAULT '',
    pool_start     VARCHAR(50) NOT NULL DEFAULT '',
    pool_end       VARCHAR(50) NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, router_id)
);

CREATE INDEX IF NOT EXISTS idx_pppoe_ip_settings_tenant ON pppoe_ip_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pppoe_ip_settings_router ON pppoe_ip_settings(router_id);
