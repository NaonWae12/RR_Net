DROP INDEX IF EXISTS idx_vouchers_tenant_batch_id;
ALTER TABLE vouchers DROP COLUMN IF EXISTS batch_id;
