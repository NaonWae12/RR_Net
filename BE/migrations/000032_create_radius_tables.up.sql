-- RADIUS Authentication Attempts (audit log for all Access-Request packets)
CREATE TABLE IF NOT EXISTS radius_auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    
    -- Request details
    username VARCHAR(255) NOT NULL,
    nas_ip_address VARCHAR(45),
    nas_port_id VARCHAR(50),
    calling_station_id VARCHAR(50), -- Client MAC
    called_station_id VARCHAR(50),  -- AP MAC
    
    -- Response
    auth_result VARCHAR(20) NOT NULL, -- 'accept', 'reject', 'error'
    reject_reason TEXT,
    
    -- Attribution
    voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_auth_result CHECK (auth_result IN ('accept', 'reject', 'error'))
);

CREATE INDEX idx_radius_auth_tenant_id ON radius_auth_attempts(tenant_id);
CREATE INDEX idx_radius_auth_username ON radius_auth_attempts(username);
CREATE INDEX idx_radius_auth_created_at ON radius_auth_attempts(created_at DESC);
CREATE INDEX idx_radius_auth_result ON radius_auth_attempts(auth_result);

-- RADIUS Sessions (accounting Start/Interim/Stop)
CREATE TABLE IF NOT EXISTS radius_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
    
    -- Session identity
    acct_session_id VARCHAR(255) NOT NULL,
    acct_unique_id VARCHAR(255),
    
    -- User/connection
    username VARCHAR(255) NOT NULL,
    nas_ip_address VARCHAR(45),
    nas_port_id VARCHAR(50),
    framed_ip_address VARCHAR(45),
    calling_station_id VARCHAR(50), -- Client MAC
    called_station_id VARCHAR(50),  -- AP MAC
    
    -- Timing
    acct_start_time TIMESTAMPTZ,
    acct_stop_time TIMESTAMPTZ,
    acct_session_time INTEGER, -- seconds
    
    -- Counters (updated on Interim-Update and Stop)
    acct_input_octets BIGINT DEFAULT 0,
    acct_output_octets BIGINT DEFAULT 0,
    acct_input_packets BIGINT DEFAULT 0,
    acct_output_packets BIGINT DEFAULT 0,
    
    -- Termination
    acct_terminate_cause VARCHAR(50),
    
    -- Status
    session_status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_session_status CHECK (session_status IN ('active', 'stopped'))
);

CREATE UNIQUE INDEX idx_radius_sessions_acct_session_id ON radius_sessions(acct_session_id);
CREATE INDEX idx_radius_sessions_tenant_id ON radius_sessions(tenant_id);
CREATE INDEX idx_radius_sessions_username ON radius_sessions(username);
CREATE INDEX idx_radius_sessions_voucher_id ON radius_sessions(voucher_id);
CREATE INDEX idx_radius_sessions_status ON radius_sessions(session_status);
CREATE INDEX idx_radius_sessions_start_time ON radius_sessions(acct_start_time DESC);

