-- Migration: Add max_client_maps to existing plans
-- Adds max_client_maps limit to all plans:
--   Basic: 0
--   Pro: 0
--   Business: 600
--   Enterprise: -1

UPDATE plans
SET limits = jsonb_set(
    limits,
    '{max_client_maps}',
    CASE 
        WHEN code = 'basic' THEN '0'::jsonb
        WHEN code = 'pro' THEN '0'::jsonb
        WHEN code = 'business' THEN '600'::jsonb
        WHEN code = 'enterprise' THEN '-1'::jsonb
        ELSE '0'::jsonb
    END
)
WHERE code IN ('basic', 'pro', 'business', 'enterprise');

