-- Migration: Create WhatsApp templates + unified message logs
-- Templates: tenant-scoped plain-text templates
-- Logs: tenant-scoped audit trail for WA sends (single/campaign/system)

CREATE TABLE IF NOT EXISTS wa_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_templates_tenant_name
    ON wa_templates(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant_id
    ON wa_templates(tenant_id);

CREATE TRIGGER update_wa_templates_updated_at
    BEFORE UPDATE ON wa_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS wa_message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- single | campaign | system
    source VARCHAR(20) NOT NULL CHECK (source IN ('single', 'campaign', 'system')),

    campaign_id UUID REFERENCES wa_campaigns(id) ON DELETE SET NULL,
    campaign_recipient_id UUID REFERENCES wa_campaign_recipients(id) ON DELETE SET NULL,

    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(200),

    to_phone VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    template_id UUID REFERENCES wa_templates(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),

    gateway_message_id TEXT,
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_message_logs_tenant_created_at
    ON wa_message_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_message_logs_tenant_status
    ON wa_message_logs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wa_message_logs_tenant_to_phone
    ON wa_message_logs(tenant_id, to_phone);

CREATE INDEX IF NOT EXISTS idx_wa_message_logs_tenant_campaign_id
    ON wa_message_logs(tenant_id, campaign_id);


