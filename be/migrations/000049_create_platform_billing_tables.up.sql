-- Create platform_invoices table
CREATE TABLE platform_invoices (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_id UUID NOT NULL REFERENCES plans(id),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    amount BIGINT NOT NULL, -- in cents/smallest unit
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
    paid_amount BIGINT NOT NULL DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create platform_payments table
CREATE TABLE platform_payments (
    id UUID PRIMARY KEY,
    platform_invoice_id UUID NOT NULL REFERENCES platform_invoices(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    method VARCHAR(50) NOT NULL, -- bank_transfer, qris, etc.
    reference VARCHAR(100),
    proof_image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, verified, rejected
    notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indices
CREATE INDEX idx_platform_invoices_tenant_id ON platform_invoices(tenant_id);
CREATE INDEX idx_platform_invoices_status ON platform_invoices(status);
CREATE INDEX idx_platform_payments_invoice_id ON platform_payments(platform_invoice_id);
CREATE INDEX idx_platform_payments_tenant_id ON platform_payments(tenant_id);
