-- Technician tasks table
CREATE TABLE IF NOT EXISTS technician_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    task_type VARCHAR(30) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_type VARCHAR(20),
    location_id UUID,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_hours DECIMAL(5, 2),
    actual_hours DECIMAL(5, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_task_type CHECK (task_type IN ('installation', 'maintenance', 'repair', 'inspection', 'outage', 'other')),
    CONSTRAINT valid_task_priority CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT valid_task_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT valid_location_type CHECK (location_type IS NULL OR location_type IN ('odc', 'odp', 'client', 'address'))
);

CREATE INDEX idx_technician_tasks_tenant_id ON technician_tasks(tenant_id);
CREATE INDEX idx_technician_tasks_technician_id ON technician_tasks(technician_id);
CREATE INDEX idx_technician_tasks_status ON technician_tasks(status);
CREATE INDEX idx_technician_tasks_scheduled_at ON technician_tasks(scheduled_at);
CREATE INDEX idx_technician_tasks_location ON technician_tasks(location_type, location_id);

-- Technician activity logs table
CREATE TABLE IF NOT EXISTS technician_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES technician_tasks(id) ON DELETE SET NULL,
    activity_type VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    location_type VARCHAR(20),
    location_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    photo_urls TEXT[], -- Array of photo URLs
    metadata TEXT, -- JSON string for additional data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_tenant_id ON technician_activity_logs(tenant_id);
CREATE INDEX idx_activity_logs_technician_id ON technician_activity_logs(technician_id);
CREATE INDEX idx_activity_logs_task_id ON technician_activity_logs(task_id);
CREATE INDEX idx_activity_logs_created_at ON technician_activity_logs(created_at);
CREATE INDEX idx_activity_logs_activity_type ON technician_activity_logs(activity_type);

