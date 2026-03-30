-- Migration: Add discount_id column to clients table
-- Allows clients to reference a specific discount

ALTER TABLE clients 
ADD COLUMN discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL;

CREATE INDEX idx_clients_discount_id ON clients(discount_id);

COMMENT ON COLUMN clients.discount_id IS 'Reference to discount applied to this client';

