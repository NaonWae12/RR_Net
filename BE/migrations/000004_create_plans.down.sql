-- Rollback: Drop plans table
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
DROP TABLE IF EXISTS plans;

