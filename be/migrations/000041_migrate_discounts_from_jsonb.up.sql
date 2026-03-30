-- Migration: Migrate discount data from tenants.settings JSONB to discounts table
-- Only migrate enabled discounts (disabled ones are just defaults, not real discounts)

INSERT INTO discounts (tenant_id, name, type, value, expires_at, is_active, created_at, updated_at)
SELECT 
    t.id as tenant_id,
    'Global Discount (Migrated)' as name,
    CASE 
        WHEN (t.settings->'service_discount'->>'type') = 'nominal' THEN 'nominal'
        ELSE 'percent'
    END as type,
    COALESCE((t.settings->'service_discount'->>'value')::DECIMAL, 0) as value,
    NULL as expires_at, -- No expiry in old system
    COALESCE((t.settings->'service_discount'->>'enabled')::BOOLEAN, false) as is_active,
    NOW() as created_at,
    NOW() as updated_at
FROM tenants t
WHERE t.settings->'service_discount'->>'enabled' = 'true'
  AND t.settings->'service_discount' IS NOT NULL
  AND COALESCE((t.settings->'service_discount'->>'value')::DECIMAL, 0) > 0; -- Only migrate if value > 0

-- Cleanup: Remove service_discount key from tenants.settings JSONB
UPDATE tenants
SET settings = settings - 'service_discount'
WHERE settings->'service_discount' IS NOT NULL;

