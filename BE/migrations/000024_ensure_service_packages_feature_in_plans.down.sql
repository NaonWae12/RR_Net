-- Rollback: remove service_packages feature from non-enterprise plans

UPDATE plans
SET features = features - 'service_packages'
WHERE code IN ('basic', 'pro', 'business');


