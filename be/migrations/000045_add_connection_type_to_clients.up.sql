ALTER TABLE clients ADD COLUMN connection_type VARCHAR(20) DEFAULT 'pppoe';
ALTER TABLE clients ADD COLUMN router_id UUID;
ALTER TABLE clients ADD COLUMN pppoe_local_address VARCHAR(50);
ALTER TABLE clients ADD COLUMN pppoe_remote_address VARCHAR(50);
ALTER TABLE clients ADD COLUMN pppoe_comment TEXT;

-- Add foreign key constraint for router_id if routers table exists
-- ALTER TABLE clients ADD CONSTRAINT fk_client_router FOREIGN KEY (router_id) REFERENCES routers(id);
