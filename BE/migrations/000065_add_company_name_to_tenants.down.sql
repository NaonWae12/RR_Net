-- Remove company_name column from tenants table
DROP INDEX IF EXISTS idx_tenants_company_name;
ALTER TABLE tenants DROP COLUMN IF EXISTS company_name;
