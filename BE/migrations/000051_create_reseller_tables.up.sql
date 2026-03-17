-- Resellers table (clients who are upgraded to reseller status)
CREATE TABLE IF NOT EXISTS resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Metadata
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_reseller_status CHECK (status IN ('active', 'suspended')),
    CONSTRAINT unique_reseller_per_tenant UNIQUE (tenant_id, client_id)
);

CREATE INDEX idx_resellers_tenant_id ON resellers(tenant_id);
CREATE INDEX idx_resellers_client_id ON resellers(client_id);
CREATE INDEX idx_resellers_status ON resellers(tenant_id, status);

-- Reseller custom pricing (override voucher package prices for resellers)
CREATE TABLE IF NOT EXISTS reseller_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
    voucher_package_id UUID NOT NULL REFERENCES voucher_packages(id) ON DELETE CASCADE,
    
    -- Custom pricing
    reseller_price DECIMAL(12,2) NOT NULL,
    retail_price DECIMAL(12,2) NOT NULL,
    margin DECIMAL(12,2) GENERATED ALWAYS AS (retail_price - reseller_price) STORED,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_reseller_package_price UNIQUE (reseller_id, voucher_package_id),
    CONSTRAINT valid_reseller_price CHECK (reseller_price >= 0 AND retail_price >= reseller_price)
);

CREATE INDEX idx_reseller_prices_tenant_id ON reseller_prices(tenant_id);
CREATE INDEX idx_reseller_prices_reseller_id ON reseller_prices(reseller_id);
CREATE INDEX idx_reseller_prices_package_id ON reseller_prices(voucher_package_id);

-- Reseller discount codes (promo codes for reseller purchases)
CREATE TABLE IF NOT EXISTS reseller_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Promo code
    code VARCHAR(50) NOT NULL,
    
    -- Discount rule (references discount table for base rules)
    discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
    rule_name VARCHAR(100) NOT NULL,
    
    -- Discount value
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(12,2) NOT NULL,
    
    -- Validity
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_discount_type CHECK (discount_type IN ('fixed', 'percentage')),
    CONSTRAINT valid_discount_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT unique_promo_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_reseller_discounts_tenant_id ON reseller_discounts(tenant_id);
CREATE INDEX idx_reseller_discounts_code ON reseller_discounts(tenant_id, code);
CREATE INDEX idx_reseller_discounts_status ON reseller_discounts(status);

-- Reseller purchase history (voucher generation transactions)
CREATE TABLE IF NOT EXISTS reseller_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
    voucher_package_id UUID NOT NULL REFERENCES voucher_packages(id) ON DELETE RESTRICT,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    
    -- Purchase details
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    
    -- Discount applied
    discount_id UUID REFERENCES reseller_discounts(id) ON DELETE SET NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Total
    total_amount DECIMAL(12,2) NOT NULL,
    
    -- Payment
    payment_method VARCHAR(50) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_purchase_quantity CHECK (quantity > 0),
    CONSTRAINT valid_purchase_amounts CHECK (unit_price >= 0 AND subtotal >= 0 AND total_amount >= 0),
    CONSTRAINT valid_purchase_status CHECK (status IN ('success', 'pending', 'failed'))
);

CREATE INDEX idx_reseller_purchases_tenant_id ON reseller_purchases(tenant_id);
CREATE INDEX idx_reseller_purchases_reseller_id ON reseller_purchases(reseller_id);
CREATE INDEX idx_reseller_purchases_package_id ON reseller_purchases(voucher_package_id);
CREATE INDEX idx_reseller_purchases_created_at ON reseller_purchases(created_at DESC);
CREATE INDEX idx_reseller_purchases_status ON reseller_purchases(status);
