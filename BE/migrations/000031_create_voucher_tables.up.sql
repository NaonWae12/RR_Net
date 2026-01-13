-- Voucher Packages (speed/profile templates for vouchers)
CREATE TABLE IF NOT EXISTS voucher_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Speed limits (in Kbps)
    download_speed INTEGER NOT NULL,
    upload_speed INTEGER NOT NULL,
    
    -- Duration (in hours, NULL = unlimited)
    duration_hours INTEGER,
    
    -- Quota (in MB, NULL = unlimited)
    quota_mb INTEGER,
    
    -- Pricing
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_speed CHECK (download_speed > 0 AND upload_speed > 0)
);

CREATE INDEX idx_voucher_packages_tenant_id ON voucher_packages(tenant_id);
CREATE INDEX idx_voucher_packages_tenant_active ON voucher_packages(tenant_id, is_active);

-- Vouchers (generated codes for Hotspot authentication)
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES voucher_packages(id) ON DELETE RESTRICT,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL, -- Optional: tie voucher to specific router
    
    -- Voucher code (used as username in RADIUS)
    code VARCHAR(50) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Usage tracking
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Session tracking (first successful auth)
    first_session_id UUID,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_voucher_status CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX idx_vouchers_tenant_code ON vouchers(tenant_id, code);
CREATE INDEX idx_vouchers_tenant_id ON vouchers(tenant_id);
CREATE INDEX idx_vouchers_package_id ON vouchers(package_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_expires_at ON vouchers(expires_at);

-- Voucher Usage (detailed usage logs per session)
CREATE TABLE IF NOT EXISTS voucher_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    session_id VARCHAR(255), -- RADIUS Acct-Session-Id
    
    -- Usage counters
    bytes_in BIGINT NOT NULL DEFAULT 0,
    bytes_out BIGINT NOT NULL DEFAULT 0,
    packets_in BIGINT NOT NULL DEFAULT 0,
    packets_out BIGINT NOT NULL DEFAULT 0,
    
    -- Session times
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_stop TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Termination
    terminate_cause VARCHAR(50),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voucher_usage_voucher_id ON voucher_usage(voucher_id);
CREATE INDEX idx_voucher_usage_session_id ON voucher_usage(session_id);
CREATE INDEX idx_voucher_usage_router_id ON voucher_usage(router_id);

