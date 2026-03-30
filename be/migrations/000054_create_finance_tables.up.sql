-- Create finance_transactions table
CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- income, expense
    source VARCHAR(50) NOT NULL, -- voucher_usage, reseller_purchase, billing_payment
    source_id UUID NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant_balances table
CREATE TABLE IF NOT EXISTS tenant_balances (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_finance_transactions_tenant_id ON finance_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_created_at ON finance_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_source ON finance_transactions(source);
