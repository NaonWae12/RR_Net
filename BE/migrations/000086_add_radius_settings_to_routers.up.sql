-- Up
ALTER TABLE routers ADD COLUMN idle_timeout INTEGER DEFAULT 600;
ALTER TABLE routers ADD COLUMN interim_interval INTEGER DEFAULT 60;

-- Down
ALTER TABLE routers DROP COLUMN idle_timeout;
ALTER TABLE routers DROP COLUMN interim_interval;
