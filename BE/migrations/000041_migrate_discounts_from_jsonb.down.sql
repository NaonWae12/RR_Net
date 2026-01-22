-- Rollback: Cannot fully rollback migrated data, but we can restore the JSONB structure
-- Note: This will restore default disabled discount, not the actual migrated data

-- Restore service_discount key with default disabled values
UPDATE tenants
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{service_discount}',
    '{"enabled": false, "type": "percent", "value": 0}'::jsonb,
    true
)
WHERE settings->'service_discount' IS NULL;

-- Note: Migrated discount records in discounts table will remain
-- They should be manually deleted if full rollback is needed

