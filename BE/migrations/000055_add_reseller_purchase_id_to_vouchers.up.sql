-- Add reseller_purchase_id to vouchers to link them to a specific reseller purchase
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS reseller_purchase_id UUID REFERENCES reseller_purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_reseller_purchase_id ON vouchers(reseller_purchase_id);
