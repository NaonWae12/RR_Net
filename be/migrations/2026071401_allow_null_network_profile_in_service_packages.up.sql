-- Migration: Allow NULL in network_profile_id column of service_packages table
ALTER TABLE service_packages ALTER COLUMN network_profile_id DROP NOT NULL;
