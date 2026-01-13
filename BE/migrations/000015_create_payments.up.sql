-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    method VARCHAR(30) NOT NULL DEFAULT 'cash',
    reference VARCHAR(100),
    collector_id UUID REFERENCES users(id),
    notes TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    CONSTRAINT valid_payment_method CHECK (method IN ('cash', 'bank_transfer', 'e_wallet', 'qris', 'virtual_account', 'collector'))
);

CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_collector_id ON payments(collector_id);
CREATE INDEX idx_payments_received_at ON payments(received_at);
CREATE INDEX idx_payments_method ON payments(method);


