-- Migration: Ensure RBAC features are present in all plans
-- Ensures rbac_employee and rbac_client_reseller features are in the features array
-- for plans that should have them:
--   Basic: No rbac_employee, no rbac_client_reseller feature (correct as is)
--   Pro: Has rbac_employee, has rbac_client_reseller feature
--   Business: Has rbac_employee, has rbac_client_reseller feature
--   Enterprise: Has "*" (all features, including rbac_employee and rbac_client_reseller)

-- Update Pro plan: add rbac_employee if missing
UPDATE plans
SET features = features || '["rbac_employee"]'::jsonb
WHERE code = 'pro'
  AND NOT (features @> '["rbac_employee"]'::jsonb);

-- Update Pro plan: add rbac_client_reseller if missing
UPDATE plans
SET features = features || '["rbac_client_reseller"]'::jsonb
WHERE code = 'pro'
  AND NOT (features @> '["rbac_client_reseller"]'::jsonb);

-- Update Business plan: add rbac_employee if missing
UPDATE plans
SET features = features || '["rbac_employee"]'::jsonb
WHERE code = 'business'
  AND NOT (features @> '["rbac_employee"]'::jsonb);

-- Update Business plan: add rbac_client_reseller if missing
UPDATE plans
SET features = features || '["rbac_client_reseller"]'::jsonb
WHERE code = 'business'
  AND NOT (features @> '["rbac_client_reseller"]'::jsonb);

-- Enterprise already has "*" which includes all features, so no update needed
-- But ensure it has "*" if somehow missing
UPDATE plans
SET features = '["*"]'::jsonb
WHERE code = 'enterprise'
  AND features != '["*"]'::jsonb;
