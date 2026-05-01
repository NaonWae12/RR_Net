ALTER TABLE platform_invoices ADD COLUMN addon_id UUID REFERENCES addons(id) ON DELETE SET NULL;
ALTER TABLE platform_invoices ADD COLUMN addon_quantity INTEGER;
