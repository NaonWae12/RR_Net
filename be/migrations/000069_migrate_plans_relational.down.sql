-- Migration Down: Remove relational tables for plan features and limits
-- Note: We don't delete data from plans.features/limits as it remained there

DROP TABLE IF EXISTS plan_features;
DROP TABLE IF EXISTS plan_limits;
DROP TABLE IF EXISTS feature_metadata;
