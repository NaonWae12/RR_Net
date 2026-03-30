-- Migration: Create billing tempo templates + extend clients with payment tempo fields
-- Goal: allow tenant to define named templates (day 1-31) and store client-level due-day rules.

CREATE TABLE IF NOT EXISTS billing_tempo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    due_day INT NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_billing_tempo_template_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_billing_tempo_templates_tenant_id ON billing_tempo_templates(tenant_id);

CREATE TRIGGER update_billing_tempo_templates_updated_at
    BEFORE UPDATE ON billing_tempo_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE billing_tempo_templates IS 'Tenant-defined named templates for monthly payment due-day (1-31)';

-- Extend clients with tempo configuration
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS payment_tempo_option VARCHAR(20) NOT NULL DEFAULT 'default'
        CHECK (payment_tempo_option IN ('default', 'template', 'manual')),
    ADD COLUMN IF NOT EXISTS payment_due_day INT NOT NULL DEFAULT (date_part('day', NOW())::int)
        CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
    ADD COLUMN IF NOT EXISTS payment_tempo_template_id UUID REFERENCES billing_tempo_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_payment_due_day ON clients(payment_due_day);
CREATE INDEX IF NOT EXISTS idx_clients_payment_tempo_template_id ON clients(payment_tempo_template_id);


