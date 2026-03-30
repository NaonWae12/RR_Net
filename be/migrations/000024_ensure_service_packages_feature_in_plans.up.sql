-- Migration: Ensure service_packages feature is present in all plans that should have it
-- Basic/Pro/Business: add service_packages
-- Enterprise: keeps "*"

UPDATE plans
SET features = features || '["service_packages"]'::jsonb
WHERE code IN ('basic', 'pro', 'business')
  AND NOT (features @> '["service_packages"]'::jsonb);

-- Ensure enterprise stays wildcard
UPDATE plans
SET features = '["*"]'::jsonb
WHERE code = 'enterprise'
  AND features != '["*"]'::jsonb;


