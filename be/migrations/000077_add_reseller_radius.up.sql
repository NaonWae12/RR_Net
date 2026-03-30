-- Add reseller_radius to resellers table
ALTER TABLE resellers ADD COLUMN reseller_radius INTEGER NOT NULL DEFAULT 0;
