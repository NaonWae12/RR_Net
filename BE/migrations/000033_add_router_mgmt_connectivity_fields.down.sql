DROP INDEX IF EXISTS idx_routers_connectivity_mode;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'routers_connectivity_mode_check'
    ) THEN
        ALTER TABLE routers
            DROP CONSTRAINT routers_connectivity_mode_check;
    END IF;
END $$;

ALTER TABLE routers
    DROP COLUMN IF EXISTS api_use_tls,
    DROP COLUMN IF EXISTS connectivity_mode;




