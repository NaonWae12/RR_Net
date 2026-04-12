-- Migration: Change design slugs to support multiple values (comma-separated)
ALTER TABLE tenants 
ALTER COLUMN default_voucher_design_slug TYPE TEXT,
ALTER COLUMN reseller_voucher_design_slug TYPE TEXT;

-- Reset existing ones to be safe or keep them as single-item lists
UPDATE tenants SET default_voucher_design_slug = 'simple' WHERE default_voucher_design_slug IS NULL OR default_voucher_design_slug = '';
UPDATE tenants SET reseller_voucher_design_slug = 'simple' WHERE reseller_voucher_design_slug IS NULL OR reseller_voucher_design_slug = '';
