-- Migration: Remove WiFi tracking columns from acs_device_tenants
ALTER TABLE acs_device_tenants
    DROP COLUMN IF EXISTS wifi_updated_at,
    DROP COLUMN IF EXISTS wifi_password,
    DROP COLUMN IF EXISTS wifi_ssid;
