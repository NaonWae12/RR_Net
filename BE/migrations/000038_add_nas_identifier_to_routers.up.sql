-- Add NAS Identifier to routers
ALTER TABLE routers ADD COLUMN nas_identifier VARCHAR(100);

-- Populate existing routers with their ID as nas_identifier to avoid nulls
UPDATE routers SET nas_identifier = id::text WHERE nas_identifier IS NULL;

-- Create Unique Index
CREATE UNIQUE INDEX idx_routers_nas_identifier ON routers(nas_identifier);

-- Drop old index on nas_ip if exists (it might be just a normal index, but we want to ensure it's not unique or just re-create it as standard index if needed)
-- In previous migrations it was just INDEX, not UNIQUE, so it's fine.
-- But it's good practice to ensure nas_ip is indexed efficiently for fallback
DROP INDEX IF EXISTS idx_routers_nas_ip;
CREATE INDEX idx_routers_nas_ip ON routers(nas_ip);
