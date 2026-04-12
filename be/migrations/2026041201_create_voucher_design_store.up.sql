-- Create voucher_designs table (The Catalog)
CREATE TABLE IF NOT EXISTS voucher_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    preview_url TEXT,
    price DECIMAL(15, 2) DEFAULT 0,
    is_free BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tenant_designs table (Ownership)
CREATE TABLE IF NOT EXISTS tenant_designs (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    design_id UUID NOT NULL REFERENCES voucher_designs(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, design_id)
);

-- Seed initial free templates
INSERT INTO voucher_designs (slug, name, description, is_free) VALUES
('simple', 'Simple Card', 'Clean and minimalist design for fast printing', true),
('branded', 'Branded Gradient', 'Modern design with colorful indigo-purple gradients', true),
('mikhmon', 'Mikhmon Classic', 'Classic horizontal layout inspired by the popular Mikhmon tool', true)
ON CONFLICT (slug) DO NOTHING;

-- Add index for faster ownership checks
CREATE INDEX IF NOT EXISTS idx_tenant_designs_tenant ON tenant_designs(tenant_id);
