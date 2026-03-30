-- Migration: add created_by_id to clients (tracks who created the client — useful for technician requests)

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN clients.created_by_id IS 'User (technician/admin/owner) who created this client record';
