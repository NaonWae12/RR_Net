-- Remove shared_users from vouchers table
ALTER TABLE vouchers DROP COLUMN IF EXISTS shared_users;
