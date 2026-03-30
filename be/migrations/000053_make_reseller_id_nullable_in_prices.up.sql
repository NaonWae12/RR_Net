-- Allow NULL reseller_id for global/default reseller pricing
ALTER TABLE reseller_prices ALTER COLUMN reseller_id DROP NOT NULL;

-- Update unique constraint to handle NULL reseller_id
ALTER TABLE reseller_prices DROP CONSTRAINT IF EXISTS unique_reseller_package_price;

-- Create a partial index for global prices
CREATE UNIQUE INDEX IF NOT EXISTS idx_reseller_prices_global_package ON reseller_prices (voucher_package_id) WHERE reseller_id IS NULL;

-- Create a unique index for specific reseller prices
CREATE UNIQUE INDEX IF NOT EXISTS idx_reseller_prices_reseller_package ON reseller_prices (reseller_id, voucher_package_id) WHERE reseller_id IS NOT NULL;
