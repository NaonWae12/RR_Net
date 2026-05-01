-- Migration: Revert tenant_addons foreign key to ON DELETE RESTRICT

ALTER TABLE tenant_addons DROP CONSTRAINT IF EXISTS tenant_addons_addon_id_fkey;

ALTER TABLE tenant_addons
ADD CONSTRAINT tenant_addons_addon_id_fkey
FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE RESTRICT;
