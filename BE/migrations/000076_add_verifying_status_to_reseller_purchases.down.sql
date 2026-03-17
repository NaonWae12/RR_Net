-- migration for adding verifying to valid_purchase_status constraint
-- DOWN
ALTER TABLE reseller_purchases DROP CONSTRAINT IF EXISTS valid_purchase_status;
ALTER TABLE reseller_purchases ADD CONSTRAINT valid_purchase_status CHECK (status IN ('success', 'pending', 'failed', 'paylater'));
