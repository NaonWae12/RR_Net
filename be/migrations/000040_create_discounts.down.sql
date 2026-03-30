-- Rollback: Drop discounts table

DROP TRIGGER IF EXISTS update_discounts_updated_at ON discounts;
DROP TABLE IF EXISTS discounts;

