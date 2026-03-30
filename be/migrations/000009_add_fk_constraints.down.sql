-- Rollback: Remove foreign key constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS fk_tenants_plan_id;

