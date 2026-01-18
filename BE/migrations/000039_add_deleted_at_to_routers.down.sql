ALTER TABLE routers DROP COLUMN IF NOT EXISTS deleted_at;

ALTER TABLE routers DROP CONSTRAINT IF EXISTS valid_router_status;
ALTER TABLE routers ADD CONSTRAINT valid_router_status 
    CHECK (status IN ('online', 'offline', 'maintenance', 'provisioning'));
