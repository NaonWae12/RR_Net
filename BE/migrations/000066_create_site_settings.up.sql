-- Migration: Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_site_settings_updated_at
    BEFORE UPDATE ON site_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO site_settings (key, value, description) VALUES
(
    'landing_page_seo',
    '{"title": "RRNET | All-in-One ERP for ISP", "description": "Scale your ISP business with automation.", "keywords": ["ISP", "ERP", "RRNET"]}',
    'SEO Metadata for Landing Page'
),
(
    'landing_page_pricing',
    '{
        "display_count": 3,
        "show_monthly": true,
        "show_yearly": true,
        "plans": [],
        "popular_plan_id": "",
        "yearly_discount": 20
    }',
    'Pricing section configuration for Landing Page'
);
