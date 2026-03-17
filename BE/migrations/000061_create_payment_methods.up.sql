CREATE TABLE payment_methods (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'bank', 'cash', 'e-wallet'
    provider VARCHAR(100),         -- 'BCA', 'Mandiri', 'OVO'
    account_number VARCHAR(100),
    account_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_tenant ON payment_methods(tenant_id);

-- Update the previous columns to use ID instead of string
ALTER TABLE reimbursements DROP COLUMN payment_method;
ALTER TABLE reimbursements ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);

ALTER TABLE payslips DROP COLUMN payment_method;
ALTER TABLE payslips ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);

ALTER TABLE payroll_runs DROP COLUMN payment_method;
ALTER TABLE payroll_runs ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);
