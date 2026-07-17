-- Rollback: Set NOT NULL constraint back on network_profile_id column of service_packages table
ALTER TABLE service_packages ALTER COLUMN network_profile_id SET NOT NULL;
