-- Add VPN fields to routers table
ALTER TABLE routers ADD COLUMN vpn_username VARCHAR(100);
ALTER TABLE routers ADD COLUMN vpn_password VARCHAR(100);
ALTER TABLE routers ADD COLUMN vpn_script TEXT;
