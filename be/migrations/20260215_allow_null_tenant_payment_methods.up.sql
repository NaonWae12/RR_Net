-- Migration: Allow NULL tenant_id for platform-level payment methods
-- This allows super admin to create payment methods that are available to all tenants

BEGIN;

-- Drop the NOT NULL constraint on tenant_id
ALTER TABLE payment_methods 
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Add a comment to explain the NULL value
COMMENT ON COLUMN payment_methods.tenant_id IS 
  'Tenant ID. NULL for platform-level payment methods (managed by super admin), or specific tenant UUID for tenant-specific methods.';

COMMIT;
