-- Migration: Add tier retention/expiry support for affiliates
-- Allows tiers to be maintained for a grace period even if active referral count drops below threshold

ALTER TABLE affiliates 
ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tier_upgraded_at TIMESTAMPTZ DEFAULT NOW();

-- Add a comment explaining the field
COMMENT ON COLUMN affiliates.tier_expires_at IS 'The date when the currently earned tier will expire if the affiliate does not meet the requirements by then. Used as a grace period.';
