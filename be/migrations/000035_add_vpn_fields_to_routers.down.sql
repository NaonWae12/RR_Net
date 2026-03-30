-- Remove VPN fields from routers table
ALTER TABLE routers DROP COLUMN vpn_username;
ALTER TABLE routers DROP COLUMN vpn_password;
ALTER TABLE routers DROP COLUMN vpn_script;
