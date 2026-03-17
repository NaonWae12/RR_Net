-- Time off requests table
CREATE TABLE IF NOT EXISTS time_offs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- 'leave', 'sick', 'emergency'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_off_type CHECK (type IN ('leave', 'sick', 'emergency')),
    CONSTRAINT valid_time_off_status CHECK (status IN ('pending_approval', 'approved', 'rejected'))
);

CREATE INDEX idx_time_offs_tenant_id ON time_offs(tenant_id);
CREATE INDEX idx_time_offs_user_id ON time_offs(user_id);
CREATE INDEX idx_time_offs_status ON time_offs(status);
CREATE INDEX idx_time_offs_dates ON time_offs(start_date, end_date);
