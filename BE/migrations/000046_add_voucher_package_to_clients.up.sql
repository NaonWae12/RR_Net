-- Add voucher_package_id to clients table for Hotspot users
ALTER TABLE clients ADD COLUMN voucher_package_id UUID REFERENCES voucher_packages(id) ON DELETE SET NULL;

-- Add index for voucher_package_id
CREATE INDEX idx_clients_voucher_package_id ON clients(voucher_package_id);
