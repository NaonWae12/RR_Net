-- Migration: Create discounts table
-- Multiple discounts per tenant with expiry support

CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Discount info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'nominal')),
    value DECIMAL(12, 2) NOT NULL CHECK (value >= 0),
    
    -- Expiry
    expires_at TIMESTAMPTZ,                         -- NULL = tidak pernah kadaluarsa
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_discounts_tenant_id ON discounts(tenant_id);
CREATE INDEX idx_discounts_is_active ON discounts(is_active);
CREATE INDEX idx_discounts_expires_at ON discounts(expires_at);
CREATE INDEX idx_discounts_deleted_at ON discounts(deleted_at) WHERE deleted_at IS NULL;

-- Unique name per tenant (soft delete aware - partial unique index)
CREATE UNIQUE INDEX unique_discount_name_per_tenant ON discounts(tenant_id, name) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_discounts_updated_at
    BEFORE UPDATE ON discounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE discounts IS 'Discounts/promotions that can be applied to clients';
COMMENT ON COLUMN discounts.tenant_id IS 'Tenant that owns this discount';
COMMENT ON COLUMN discounts.type IS 'percent: percentage discount (0-100), nominal: fixed amount discount';
COMMENT ON COLUMN discounts.value IS 'Discount value: percentage (0-100) or nominal amount in IDR';
COMMENT ON COLUMN discounts.expires_at IS 'When discount expires (NULL = never expires)';

