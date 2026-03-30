-- Remove status column from payments table
DROP INDEX IF EXISTS idx_payments_status;
ALTER TABLE payments DROP COLUMN IF EXISTS status;
