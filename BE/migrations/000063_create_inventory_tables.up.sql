-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL, -- SKU / System Code
    category VARCHAR(100) NOT NULL,
    description TEXT,
    min_stock INT DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pcs',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create asset_instances table (Unique unit tracking)
CREATE TABLE IF NOT EXISTS asset_instances (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'in_stock', -- in_stock, deployed, maintenance, disposed, sold
    condition VARCHAR(20) NOT NULL DEFAULT 'new', -- new, second, broken, refurbished
    location VARCHAR(255),
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_checked_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create asset_logs table (Activity Stream / Audit Trail)
CREATE TABLE IF NOT EXISTS asset_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    instance_id UUID REFERENCES asset_instances(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- STATUS_CHANGE, LOCATION_TRANSFER, DISPOSAL, etc.
    from_value TEXT,
    to_value TEXT,
    actor VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(code);
CREATE INDEX IF NOT EXISTS idx_asset_instances_asset_id ON asset_instances(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_instances_tenant_id ON asset_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_instances_status ON asset_instances(status);
CREATE INDEX IF NOT EXISTS idx_asset_logs_instance_id ON asset_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_asset_logs_tenant_id ON asset_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_logs_created_at ON asset_logs(created_at);
