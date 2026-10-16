-- Add batch_id to vouchers table to group batch generations cleanly
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Index batch_id for high-speed tenant-scoped batch operations
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_batch_id ON vouchers(tenant_id, batch_id);

-- Backfill batch_id for existing vouchers that share exact tenant_id & created_at
DO $$
DECLARE
    r RECORD;
    new_batch_id UUID;
BEGIN
    FOR r IN 
        SELECT tenant_id, created_at 
        FROM vouchers 
        WHERE batch_id IS NULL 
        GROUP BY tenant_id, created_at
    LOOP
        new_batch_id := gen_random_uuid();
        UPDATE vouchers 
        SET batch_id = new_batch_id 
        WHERE tenant_id = r.tenant_id 
          AND created_at = r.created_at 
          AND batch_id IS NULL;
    END LOOP;
END $$;
