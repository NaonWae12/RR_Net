-- Migration: Create WhatsApp campaigns tables
-- Campaign = tenant-defined bulk send operation (async)

CREATE TABLE IF NOT EXISTS wa_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'queued'
      CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),

    total INT NOT NULL DEFAULT 0,
    sent INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_tenant_id ON wa_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_tenant_status ON wa_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_created_at ON wa_campaigns(created_at DESC);

CREATE TRIGGER update_wa_campaigns_updated_at
    BEFORE UPDATE ON wa_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE wa_campaigns IS 'Tenant WhatsApp bulk send campaigns (async via asynq)';

CREATE TABLE IF NOT EXISTS wa_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,

    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'sent', 'failed')),

    error TEXT,
    message_id TEXT,
    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign_id ON wa_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign_status ON wa_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_client_id ON wa_campaign_recipients(client_id);

COMMENT ON TABLE wa_campaign_recipients IS 'Recipients of a wa_campaign with per-recipient send status';


