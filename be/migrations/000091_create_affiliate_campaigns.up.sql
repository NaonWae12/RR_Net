-- Migration: Add affiliate campaigns / growth strategies
-- Supports automated promotion periods with kuota and time limits

CREATE TABLE IF NOT EXISTS affiliate_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- JSON structure to store the tier thresholds and commissions
    -- Example: {"silver": 0, "gold": 5, "platinum": 15, "commission_silver": 15, ...}
    tier_config JSONB NOT NULL,
    
    -- Automation constraints
    max_affiliates INTEGER NOT NULL DEFAULT 0,          -- 0 means no limit (unlimited partners)
    current_affiliates_count INTEGER NOT NULL DEFAULT 0, -- Count partners joined under this campaign
    
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,                                -- NULL means no time limit
    
    is_active BOOLEAN NOT NULL DEFAULT true,            -- Manual toggle
    is_default BOOLEAN NOT NULL DEFAULT false,          -- The fallback strategy if no others are active
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one default exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_campaign_default ON affiliate_campaigns(is_default) WHERE is_default = true;

-- Trigger for updated_at
CREATE TRIGGER update_affiliate_campaigns_updated_at
    BEFORE UPDATE ON affiliate_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add campaign_id to affiliates to track who joined under which promo
ALTER TABLE affiliates 
ADD COLUMN IF NOT EXISTS joined_campaign_id UUID REFERENCES affiliate_campaigns(id) ON DELETE SET NULL;

-- Insert the current configuration as the first Default strategy
-- We'll assume the current 'affiliate_tier_thresholds' in site_settings is our base
DO $$
DECLARE
    current_settings JSONB;
BEGIN
    SELECT value FROM site_settings WHERE key = 'affiliate_tier_thresholds' INTO current_settings;
    
    IF current_settings IS NOT NULL THEN
        INSERT INTO affiliate_campaigns (name, description, tier_config, is_default, is_active)
        VALUES ('Default Strategy', 'Standard permanent affiliate rules', current_settings, true, true);
    ELSE
        -- Fallback default if nothing exists
        INSERT INTO affiliate_campaigns (name, description, tier_config, is_default, is_active)
        VALUES ('Default Strategy', 'Standard permanent affiliate rules', 
                '{"silver": 0, "gold": 5, "platinum": 15, "commission_silver": 10, "commission_gold": 20, "commission_platinum": 30, "retention_months": 3}'::jsonb, 
                true, true);
    END IF;
END $$;
