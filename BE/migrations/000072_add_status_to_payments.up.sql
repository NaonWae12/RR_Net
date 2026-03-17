-- Add status column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'verified';

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
