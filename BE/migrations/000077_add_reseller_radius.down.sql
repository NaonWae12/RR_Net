-- Remove reseller_radius from resellers table
ALTER TABLE resellers DROP COLUMN IF EXISTS reseller_radius;
