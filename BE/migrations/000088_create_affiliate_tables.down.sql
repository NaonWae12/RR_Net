-- Migration Down: Drop affiliate tables and role
-- Supports the partner program for platform growth

-- 1. Drop tables first (reverse order of creation/dependency)
DROP TABLE IF EXISTS affiliate_withdrawals;
DROP TABLE IF EXISTS affiliate_commissions;
DROP TABLE IF EXISTS affiliate_referrals;
DROP TABLE IF EXISTS affiliates;

-- 2. Delete the affiliate role
DELETE FROM roles WHERE code = 'affiliate';
