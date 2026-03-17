-- Migration: Add settlement feature to Pro, Business, and Enterprise plans
-- Feature code: settlement

-- 1. Ensure feature metadata exists
INSERT INTO feature_metadata (code, name, category, description)
VALUES ('settlement', 'Collector Settlement', 'billing', 'Manage collector settlements and deposits')
ON CONFLICT (code) DO NOTHING;

-- 2. Add settlement feature to Pro and Business plans
-- Enterprise (*) is handled by wildcard logic in resolver

-- Get Pro plan ID
DO $$
DECLARE
    pro_id UUID;
    biz_id UUID;
BEGIN
    SELECT id INTO pro_id FROM plans WHERE code = 'pro';
    SELECT id INTO biz_id FROM plans WHERE code = 'business';

    -- Add to Pro
    IF pro_id IS NOT NULL THEN
        INSERT INTO plan_features (plan_id, feature_code)
        VALUES (pro_id, 'settlement')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Add to Business
    IF biz_id IS NOT NULL THEN
        INSERT INTO plan_features (plan_id, feature_code)
        VALUES (biz_id, 'settlement')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
