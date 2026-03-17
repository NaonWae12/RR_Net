-- Add margin column to reseller_purchases
ALTER TABLE reseller_purchases ADD COLUMN margin DECIMAL(12,2) NOT NULL DEFAULT 0;
