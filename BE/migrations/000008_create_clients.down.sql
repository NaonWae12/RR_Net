-- Rollback: Drop clients table
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TABLE IF EXISTS clients;

