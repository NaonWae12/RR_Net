-- Rollback: Drop addons table
DROP TRIGGER IF EXISTS update_addons_updated_at ON addons;
DROP TABLE IF EXISTS addons;

