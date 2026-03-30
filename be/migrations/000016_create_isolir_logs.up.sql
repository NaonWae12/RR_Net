-- Isolir action logs table
CREATE TABLE IF NOT EXISTS isolir_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES users(id),
    is_automatic BOOLEAN NOT NULL DEFAULT false,
    error_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_isolir_action CHECK (action IN ('isolate', 'reactivate')),
    CONSTRAINT valid_isolir_status CHECK (status IN ('pending', 'executed', 'failed', 'reverted'))
);

CREATE INDEX idx_isolir_logs_tenant_id ON isolir_logs(tenant_id);
CREATE INDEX idx_isolir_logs_client_id ON isolir_logs(client_id);
CREATE INDEX idx_isolir_logs_invoice_id ON isolir_logs(invoice_id);
CREATE INDEX idx_isolir_logs_status ON isolir_logs(status);
CREATE INDEX idx_isolir_logs_action ON isolir_logs(action);
CREATE INDEX idx_isolir_logs_created_at ON isolir_logs(created_at);


