-- Create reimbursements table
CREATE TABLE IF NOT EXISTS reimbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(50) NOT NULL, -- transport, meal, internet, supplies, medical, other
    date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted', -- submitted, approved, rejected, paid
    attachment_url TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_reimbursement_status CHECK (status IN ('submitted', 'approved', 'rejected', 'paid'))
);

CREATE INDEX idx_reimbursements_tenant_id ON reimbursements(tenant_id);
CREATE INDEX idx_reimbursements_user_id ON reimbursements(user_id);
CREATE INDEX idx_reimbursements_status ON reimbursements(status);
CREATE INDEX idx_reimbursements_date ON reimbursements(date);
