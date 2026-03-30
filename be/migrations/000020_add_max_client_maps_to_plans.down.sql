-- Migration Rollback: Remove max_client_maps from plans
-- Removes max_client_maps limit from all plans

UPDATE plans
SET limits = limits - 'max_client_maps'
WHERE limits ? 'max_client_maps';

