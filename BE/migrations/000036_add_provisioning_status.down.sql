-- Revert routers status check constraint
ALTER TABLE routers DROP CONSTRAINT valid_router_status;
ALTER TABLE routers ADD CONSTRAINT valid_router_status CHECK (status IN ('online', 'offline', 'maintenance'));
