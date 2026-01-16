-- Add Remote Access fields to routers table
ALTER TABLE routers ADD COLUMN remote_access_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE routers ADD COLUMN remote_access_port INTEGER;
