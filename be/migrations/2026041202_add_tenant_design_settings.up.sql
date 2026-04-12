-- Migration: 2026041202_add_tenant_design_settings.sql
-- Add default design settings to tenants table

ALTER TABLE tenants 
ADD COLUMN default_voucher_design_slug TEXT DEFAULT 'simple',
ADD COLUMN reseller_voucher_design_slug TEXT DEFAULT 'simple';

-- Update comment for clarity
COMMENT ON COLUMN tenants.default_voucher_design_slug IS 'Default voucher design for the tenant';
COMMENT ON COLUMN tenants.reseller_voucher_design_slug IS 'Enforced voucher design for all resellers of this tenant';
