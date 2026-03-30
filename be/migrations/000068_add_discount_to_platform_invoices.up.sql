ALTER TABLE platform_invoices 
ADD COLUMN subtotal BIGINT NOT NULL DEFAULT 0,
ADD COLUMN discount_amount BIGINT NOT NULL DEFAULT 0,
ADD COLUMN discount_id UUID REFERENCES platform_discounts(id);

-- Initialize subtotal with current amount
UPDATE platform_invoices SET subtotal = amount;
