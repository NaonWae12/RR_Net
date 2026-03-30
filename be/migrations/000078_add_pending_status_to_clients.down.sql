-- Revert client status constraints

UPDATE clients SET status = 'active' WHERE status = 'pending';
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN ('active', 'isolir', 'suspended', 'terminated'));
