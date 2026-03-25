ALTER TABLE routers DROP CONSTRAINT IF EXISTS routers_connectivity_mode_check;
ALTER TABLE routers ADD CONSTRAINT routers_connectivity_mode_check CHECK (connectivity_mode IN ('direct_public', 'vpn', 'vpn_sstp'));
