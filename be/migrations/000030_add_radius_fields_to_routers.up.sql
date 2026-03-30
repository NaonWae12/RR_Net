-- Add RADIUS-related fields to routers
ALTER TABLE routers
    ADD COLUMN IF NOT EXISTS nas_ip VARCHAR(255),
    ADD COLUMN IF NOT EXISTS radius_secret TEXT,
    ADD COLUMN IF NOT EXISTS radius_enabled BOOLEAN NOT NULL DEFAULT true;

-- Index to quickly resolve tenant/router by NAS IP
CREATE INDEX IF NOT EXISTS idx_routers_nas_ip ON routers(nas_ip);


