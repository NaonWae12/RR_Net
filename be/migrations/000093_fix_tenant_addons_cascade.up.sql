-- Migration: Fix tenant_addons foreign key to use ON DELETE CASCADE
-- This allows super admins to delete addons even if they are assigned to tenants

-- 1. Drop existing constraint
ALTER TABLE tenant_addons DROP CONSTRAINT IF EXISTS tenant_addons_addon_id_fkey;

-- 2. Re-add with CASCADE
ALTER TABLE tenant_addons
ADD CONSTRAINT tenant_addons_addon_id_fkey
FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE;
