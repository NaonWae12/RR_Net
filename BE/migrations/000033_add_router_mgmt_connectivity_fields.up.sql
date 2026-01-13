-- Add router management connectivity tiering fields
-- - connectivity_mode: direct_public | vpn
-- - api_use_tls: whether Mikrotik API uses TLS (API-SSL)

ALTER TABLE routers
    ADD COLUMN IF NOT EXISTS connectivity_mode VARCHAR(50) NOT NULL DEFAULT 'direct_public',
    ADD COLUMN IF NOT EXISTS api_use_tls BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'routers_connectivity_mode_check'
    ) THEN
        ALTER TABLE routers
            ADD CONSTRAINT routers_connectivity_mode_check
            CHECK (connectivity_mode IN ('direct_public', 'vpn'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_routers_connectivity_mode ON routers(connectivity_mode);




