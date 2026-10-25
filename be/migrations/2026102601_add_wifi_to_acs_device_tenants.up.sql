-- Migration: Add WiFi tracking columns to acs_device_tenants
ALTER TABLE acs_device_tenants
    ADD COLUMN IF NOT EXISTS wifi_ssid VARCHAR(255),
    ADD COLUMN IF NOT EXISTS wifi_password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS wifi_updated_at TIMESTAMPTZ;
