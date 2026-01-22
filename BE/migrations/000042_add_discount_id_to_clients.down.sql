-- Rollback: Remove discount_id column from clients table

DROP INDEX IF EXISTS idx_clients_discount_id;
ALTER TABLE clients DROP COLUMN IF EXISTS discount_id;

