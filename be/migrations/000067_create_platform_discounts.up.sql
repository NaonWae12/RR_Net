-- Migration: Create platform_discounts table
CREATE TABLE IF NOT EXISTS platform_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'nominal')),
    value DECIMAL(12, 2) NOT NULL CHECK (value >= 0),
    
    -- Restrictions
    min_purchase DECIMAL(12, 2) DEFAULT 0,
    max_discount DECIMAL(12, 2), -- Only relevant for 'percent' type
    
    -- Usage limits
    usage_limit INTEGER, -- NULL = unlimited
    used_count INTEGER NOT NULL DEFAULT 0,
    
    -- Expiry
    expires_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_platform_discounts_code ON platform_discounts(code);
CREATE INDEX idx_platform_discounts_is_active ON platform_discounts(is_active);
CREATE INDEX idx_platform_discounts_expires_at ON platform_discounts(expires_at);
CREATE INDEX idx_platform_discounts_deleted_at ON platform_discounts(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_platform_discounts_updated_at
    BEFORE UPDATE ON platform_discounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
