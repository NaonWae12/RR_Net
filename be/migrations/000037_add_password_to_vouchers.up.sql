-- Add password column to vouchers table
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS password VARCHAR(50);
-- Optionally update existing vouchers to have password = code
UPDATE vouchers SET password = code WHERE password IS NULL;
