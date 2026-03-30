-- Migration: Create payroll tables and add base_salary to users

-- Add base_salary to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_salary DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Create payroll_runs table
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period VARCHAR(10) NOT NULL, -- Format: YYYY-MM
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, processed, paid
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    CONSTRAINT unique_period_per_tenant UNIQUE (tenant_id, period)
);

-- Create payslips table
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    base_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_allowances DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_reimbursements DECIMAL(15, 2) NOT NULL DEFAULT 0,
    net_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    CONSTRAINT unique_payslip_per_run UNIQUE (payroll_run_id, user_id)
);

-- Create payslip_items table
CREATE TABLE IF NOT EXISTS payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL, -- allowance, deduction, reimbursement
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    reference_id UUID -- e.g. reimbursement_id
);

-- Create indexes
CREATE INDEX idx_payroll_runs_tenant_id ON payroll_runs(tenant_id);
CREATE INDEX idx_payslips_payroll_run_id ON payslips(payroll_run_id);
CREATE INDEX idx_payslips_user_id ON payslips(user_id);
CREATE INDEX idx_payslip_items_payslip_id ON payslip_items(payslip_id);
