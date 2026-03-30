-- Rollback: Drop feature_toggles table
DROP TRIGGER IF EXISTS update_feature_toggles_updated_at ON feature_toggles;
DROP TABLE IF EXISTS feature_toggles;

