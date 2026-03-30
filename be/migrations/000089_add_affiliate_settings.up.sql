-- Migration: Add affiliate tier thresholds to site_settings
INSERT INTO site_settings (key, value, description) VALUES
(
    'affiliate_tier_thresholds',
    '{
        "silver": 0,
        "gold": 5,
        "platinum": 15,
        "commission_silver": 15.0,
        "commission_gold": 25.0,
        "commission_platinum": 35.0
    }',
    'Thresholds and commission rates for affiliate tiers (Dynamic configuration)'
) ON CONFLICT (key) DO NOTHING;
