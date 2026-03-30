-- Migration Rollback: Remove rbac_client_reseller from plans
-- Note: This only removes if added by this migration, but since we check for existence
-- before adding, rollback is minimal. The field should remain as it's part of the design.

-- Remove rbac_client_reseller from limits (optional, can leave as is)
UPDATE plans
SET limits = limits - 'rbac_client_reseller'
WHERE limits ? 'rbac_client_reseller';

