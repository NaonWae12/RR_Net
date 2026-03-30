ALTER TABLE resellers DROP CONSTRAINT valid_reseller_status;
ALTER TABLE resellers ADD CONSTRAINT valid_reseller_status CHECK (status IN ('active', 'suspended', 'pending', 'rejected'));
