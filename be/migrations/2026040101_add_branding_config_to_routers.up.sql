-- Migration to add branding_config to routers table
ALTER TABLE routers ADD COLUMN branding_config JSONB DEFAULT '{}'::JSONB;
