-- Down Migration: Remove group_id from wa_campaigns

DROP INDEX IF EXISTS idx_wa_campaigns_tenant_group_id;

ALTER TABLE wa_campaigns
DROP COLUMN IF EXISTS group_id;


