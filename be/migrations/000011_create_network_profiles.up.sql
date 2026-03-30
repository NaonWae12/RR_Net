-- Network profiles (bandwidth/QoS profiles)
CREATE TABLE IF NOT EXISTS network_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    download_speed INTEGER NOT NULL, -- in Kbps
    upload_speed INTEGER NOT NULL,   -- in Kbps
    burst_download INTEGER DEFAULT 0,
    burst_upload INTEGER DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 8,
    shared_users INTEGER DEFAULT 1,
    address_pool VARCHAR(100),
    local_address VARCHAR(50),
    remote_address VARCHAR(50),
    dns_servers VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_network_profiles_tenant_id ON network_profiles(tenant_id);
CREATE INDEX idx_network_profiles_is_active ON network_profiles(is_active);


