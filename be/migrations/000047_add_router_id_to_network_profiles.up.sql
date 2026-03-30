-- Add router_id to network_profiles
ALTER TABLE network_profiles ADD COLUMN router_id UUID REFERENCES routers(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_network_profiles_router_id ON network_profiles(router_id);
