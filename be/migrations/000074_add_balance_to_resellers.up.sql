-- Add balance to resellers
ALTER TABLE resellers ADD COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0;
