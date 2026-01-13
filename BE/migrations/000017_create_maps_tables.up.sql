-- Note: PostGIS extension not available in default postgres:16-alpine
-- For production, use postgis/postgis image or install postgis extension
-- For now, using regular indexes on lat/lng columns

-- ODC (Optical Distribution Cabinet) table
CREATE TABLE IF NOT EXISTS odcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    capacity_info TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ok',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_odc_status CHECK (status IN ('ok', 'warning', 'full', 'outage'))
);

CREATE INDEX idx_odcs_tenant_id ON odcs(tenant_id);
CREATE INDEX idx_odcs_location ON odcs(latitude, longitude);

-- ODP (Optical Distribution Point) table
CREATE TABLE IF NOT EXISTS odps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    odc_id UUID NOT NULL REFERENCES odcs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    port_count INTEGER NOT NULL DEFAULT 8,
    used_ports INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ok',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_odp_status CHECK (status IN ('ok', 'warning', 'full', 'outage')),
    CONSTRAINT valid_port_count CHECK (used_ports <= port_count AND used_ports >= 0)
);

CREATE INDEX idx_odps_tenant_id ON odps(tenant_id);
CREATE INDEX idx_odps_odc_id ON odps(odc_id);
CREATE INDEX idx_odps_location ON odps(latitude, longitude);

-- Client locations table
CREATE TABLE IF NOT EXISTS client_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    odp_id UUID NOT NULL REFERENCES odps(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    connection_type VARCHAR(20) NOT NULL DEFAULT 'pppoe',
    signal_info TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ok',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_client_location_status CHECK (status IN ('ok', 'warning', 'full', 'outage')),
    CONSTRAINT valid_connection_type CHECK (connection_type IN ('pppoe', 'hotspot', 'static')),
    UNIQUE(tenant_id, client_id) -- One location per client
);

CREATE INDEX idx_client_locations_tenant_id ON client_locations(tenant_id);
CREATE INDEX idx_client_locations_client_id ON client_locations(client_id);
CREATE INDEX idx_client_locations_odp_id ON client_locations(odp_id);
CREATE INDEX idx_client_locations_location ON client_locations(latitude, longitude);

-- Outage events table
CREATE TABLE IF NOT EXISTS outage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    node_type VARCHAR(20) NOT NULL,
    node_id UUID NOT NULL,
    reason TEXT NOT NULL,
    reported_by UUID NOT NULL REFERENCES users(id),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    affected_nodes UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_node_type CHECK (node_type IN ('odc', 'odp', 'client'))
);

CREATE INDEX idx_outage_events_tenant_id ON outage_events(tenant_id);
CREATE INDEX idx_outage_events_node ON outage_events(node_type, node_id);
CREATE INDEX idx_outage_events_resolved ON outage_events(is_resolved, reported_at);

-- Topology links table (for tracking ODC->ODP->Client relationships)
CREATE TABLE IF NOT EXISTS topology_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_type VARCHAR(20) NOT NULL,
    from_id UUID NOT NULL,
    to_type VARCHAR(20) NOT NULL,
    to_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_from_type CHECK (from_type IN ('odc', 'odp', 'client')),
    CONSTRAINT valid_to_type CHECK (to_type IN ('odc', 'odp', 'client')),
    CONSTRAINT valid_topology CHECK (
        (from_type = 'odc' AND to_type = 'odp') OR
        (from_type = 'odp' AND to_type = 'client')
    ),
    UNIQUE(tenant_id, from_type, from_id, to_type, to_id)
);

CREATE INDEX idx_topology_links_tenant_id ON topology_links(tenant_id);
CREATE INDEX idx_topology_links_from ON topology_links(from_type, from_id);
CREATE INDEX idx_topology_links_to ON topology_links(to_type, to_id);

