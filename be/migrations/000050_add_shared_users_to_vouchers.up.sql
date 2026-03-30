-- Add shared_users to vouchers table
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS shared_users INTEGER NOT NULL DEFAULT 1;
