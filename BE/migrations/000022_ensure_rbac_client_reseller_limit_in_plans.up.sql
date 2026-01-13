-- Migration: Ensure rbac_client_reseller limit exists in all plans
-- Adds rbac_client_reseller limit to plans that don't have it:
--   Basic: 0
--   Pro: 70
--   Business: -1 (unlimited)
--   Enterprise: -1 (unlimited)

-- Update Basic plan: add rbac_client_reseller if missing
UPDATE plans
SET limits = jsonb_set(
    limits,
    '{rbac_client_reseller}',
    '0'::jsonb
)
WHERE code = 'basic'
  AND NOT (limits ? 'rbac_client_reseller');

-- Update Pro plan: add rbac_client_reseller if missing
UPDATE plans
SET limits = jsonb_set(
    limits,
    '{rbac_client_reseller}',
    '70'::jsonb
)
WHERE code = 'pro'
  AND NOT (limits ? 'rbac_client_reseller');

-- Update Business plan: add rbac_client_reseller if missing
UPDATE plans
SET limits = jsonb_set(
    limits,
    '{rbac_client_reseller}',
    '-1'::jsonb
)
WHERE code = 'business'
  AND NOT (limits ? 'rbac_client_reseller');

-- Update Enterprise plan: add rbac_client_reseller if missing
UPDATE plans
SET limits = jsonb_set(
    limits,
    '{rbac_client_reseller}',
    '-1'::jsonb
)
WHERE code = 'enterprise'
  AND NOT (limits ? 'rbac_client_reseller');

