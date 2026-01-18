-- Add deleted_at column for soft delete
ALTER TABLE routers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for efficient cleanup/retention queries
CREATE INDEX IF NOT EXISTS idx_routers_deleted_at ON routers(deleted_at);

-- Update status constraint if needed (though varchar usually doesn't strictly enforce unless using ENUM type, but checking constraints is good)
-- If we used CHECK constraints before, we might need to update them.
-- Based on previous migrations, we have: CHECK (status IN ('online', 'offline', 'maintenance'))
-- We need to add 'revoked' and 'provisioning' (if not already there)
ALTER TABLE routers DROP CONSTRAINT IF EXISTS valid_router_status;
ALTER TABLE routers ADD CONSTRAINT valid_router_status 
    CHECK (status IN ('online', 'offline', 'maintenance', 'provisioning', 'revoked'));
