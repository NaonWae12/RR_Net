-- Migration: Create relational tables for addon features and limits

-- 1. Create addon_features table
CREATE TABLE IF NOT EXISTS addon_features (
    addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (addon_id, feature_code)
);

-- 2. Create addon_limits table
CREATE TABLE IF NOT EXISTS addon_limits (
    addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    limit_name VARCHAR(50) NOT NULL,
    limit_value INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (addon_id, limit_name)
);

-- 3. Data Migration: Populate addon_features from JSONB
-- Extract {"feature": "code"} structure
INSERT INTO addon_features (addon_id, feature_code)
SELECT id, value->>'feature'
FROM addons
WHERE addon_type = 'feature' AND value ? 'feature'
ON CONFLICT DO NOTHING;

-- 4. Data Migration: Populate addon_limits from JSONB
-- Extract {"add_routers": 5, ...} structure
-- Note: value is a jsonb object where keys are "add_routers", etc.
INSERT INTO addon_limits (addon_id, limit_name, limit_value)
SELECT id, l.key, l.value::int
FROM addons, jsonb_each_text(value) AS l
WHERE addon_type = 'limit_boost'
ON CONFLICT DO NOTHING;
