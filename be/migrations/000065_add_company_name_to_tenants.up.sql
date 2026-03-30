-- Add company_name column to tenants table
ALTER TABLE tenants ADD COLUMN company_name VARCHAR(255);

-- Add index for company_name for faster lookups
CREATE INDEX idx_tenants_company_name ON tenants(company_name);

-- Update existing tenants to use name as company_name if null
UPDATE tenants SET company_name = name WHERE company_name IS NULL;
