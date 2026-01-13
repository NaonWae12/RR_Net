-- Migration: Add group_id to wa_campaigns
-- Store which Client Group a campaign was created from (for UI list/display)

ALTER TABLE wa_campaigns
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES client_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_tenant_group_id ON wa_campaigns(tenant_id, group_id);


