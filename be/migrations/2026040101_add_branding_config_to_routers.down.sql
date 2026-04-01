-- Rollback for branding_config column
ALTER TABLE routers DROP COLUMN IF EXISTS branding_config;
