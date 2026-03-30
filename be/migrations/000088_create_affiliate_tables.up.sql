-- Migration: Create affiliate tables and role
-- Supports the partner program for platform growth

-- 1. Insert the affiliate role into the system
INSERT INTO roles (code, name, description, is_system, permissions) 
VALUES (
    'affiliate', 
    'Affiliate / Partner', 
    'External partner who refers new tenants to the platform and earns commission', 
    true, 
    '["affiliate:dashboard", "affiliate:payout", "affiliate:marketing"]'
) ON CONFLICT (code) DO NOTHING;

-- 2. Create the affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,                 -- The referral code used in links
    tier VARCHAR(20) NOT NULL DEFAULT 'silver',       -- silver, gold, platinum
    wallet_balance DECIMAL(20, 2) NOT NULL DEFAULT 0,  -- Current spendable/withdrawable balance
    total_earnings DECIMAL(20, 2) NOT NULL DEFAULT 0,  -- Lifetime earnings
    referred_count INTEGER NOT NULL DEFAULT 0,         -- Count of successful referrals
    status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending, active, suspended
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TRIGGER update_affiliates_updated_at
    BEFORE UPDATE ON affiliates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Create the referral tracking table (Links Affiliate -> Tenant)
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    referred_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    commission_percentage DECIMAL(5, 2) NOT NULL,      -- Snapshot of percentage at time of referral
    status VARCHAR(20) NOT NULL DEFAULT 'active',     -- active, cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referred_tenant_id)                         -- One tenant can only be referred by one affiliate
);

-- 4. Create the commissions log table (Per Payment/Invoice)
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL,                          -- Reference to platform_invoices id
    amount DECIMAL(20, 2) NOT NULL,                   -- The calculated commission amount
    percentage DECIMAL(5, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending, confirmed, paid
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create the withdrawal requests table
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    account_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending, completed, rejected
    processed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
