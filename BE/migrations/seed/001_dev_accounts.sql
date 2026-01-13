-- Seed: Development Accounts
-- Creates test accounts for development and testing
-- Based on docs_plan/DEVELOPMENT_ACCOUNTS.md

-- Note: This seed script should be run AFTER all migrations are applied

-- 1. Create Super Admin Account
-- Email: admin@rrnet.test
-- Password: password
-- Role: super_admin
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
    NULL, -- Super admin has no tenant
    r.id,
    'admin@rrnet.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password" (cost 12)
    'Super Admin',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'super_admin'
  AND NOT EXISTS (
      SELECT 1
      FROM users u
      WHERE u.tenant_id IS NULL
        AND u.email = 'admin@rrnet.test'
  );

-- 2. Create Tenant: Acme Networks
-- Tenant ID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Slug: acme
INSERT INTO tenants (id, name, slug, status, billing_status, created_at, updated_at)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
    'Acme Networks',
    'acme',
    'active',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Create Owner Account for Acme Networks
-- Email: owner@acme.test
-- Password: password
-- Role: owner
-- User ID: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT 
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, -- Acme Networks tenant
    r.id,
    'owner@acme.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password" (cost 12)
    'Owner Acme',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

-- 4. Assign Pro plan to Acme Networks tenant
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE t.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID
  AND p.code = 'pro';

-- 5. Create Tenant: BasicCo (Basic tier)
-- Tenant ID: dddddddd-dddd-dddd-dddd-dddddddddddd
-- Slug: basicco
INSERT INTO tenants (id, name, slug, status, billing_status, created_at, updated_at)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID,
    'BasicCo ISP',
    'basicco',
    'active',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- 6. Create Owner Account for BasicCo
-- Email: owner@basicco.test
-- Password: password
-- Role: owner
-- User ID: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::UUID,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID,
    r.id,
    'owner@basicco.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password" (cost 12)
    'Owner BasicCo',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

-- 7. Assign Basic plan to BasicCo tenant
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE t.id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID
  AND p.code = 'basic';

-- 8. Create Tenant: BizNet (Business tier)
-- Tenant ID: ffffffff-ffff-ffff-ffff-ffffffffffff
-- Slug: biznet
INSERT INTO tenants (id, name, slug, status, billing_status, created_at, updated_at)
VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID,
    'BizNet ISP',
    'biznet',
    'active',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- 9. Create Owner Account for BizNet
-- Email: owner@biznet.test
-- Password: password
-- Role: owner
-- User ID: 44444444-4444-4444-4444-444444444444
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT
    '44444444-4444-4444-4444-444444444444'::UUID,
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID,
    r.id,
    'owner@biznet.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password" (cost 12)
    'Owner BizNet',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

-- 10. Assign Business plan to BizNet tenant
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE t.id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID
  AND p.code = 'business';

-- 11. Create Tenant: EntCorp (Enterprise tier)
-- Tenant ID: 22222222-2222-2222-2222-222222222222
-- Slug: entcorp
INSERT INTO tenants (id, name, slug, status, billing_status, created_at, updated_at)
VALUES (
    '22222222-2222-2222-2222-222222222222'::UUID,
    'EntCorp ISP',
    'entcorp',
    'active',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- 12. Create Owner Account for EntCorp
-- Email: owner@entcorp.test
-- Password: password
-- Role: owner
-- User ID: 33333333-3333-3333-3333-333333333333
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT
    '33333333-3333-3333-3333-333333333333'::UUID,
    '22222222-2222-2222-2222-222222222222'::UUID,
    r.id,
    'owner@entcorp.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password" (cost 12)
    'Owner EntCorp',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

-- 13. Assign Enterprise plan to EntCorp tenant
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE t.id = '22222222-2222-2222-2222-222222222222'::UUID
  AND p.code = 'enterprise';

-- ============================================
-- 14. Seed Service Setup (Network Profiles + Service Packages + Global Discount default)
-- ============================================

-- 14.1 Network Profiles (required by service_packages)
-- Note: keeping one basic profile per tenant for MVP
INSERT INTO network_profiles (
  id, tenant_id, name, description, download_speed, upload_speed,
  burst_download, burst_upload, priority, shared_users,
  address_pool, local_address, remote_address, dns_servers,
  is_active, created_at, updated_at
) VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'::UUID, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, 'Default-PPPoE', 'Default PPPoE speed profile', 10000, 5000, 0, 0, 8, 1, NULL, NULL, NULL, NULL, true, NOW(), NOW()),
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1'::UUID, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID, 'Default-PPPoE', 'Default PPPoE speed profile', 5000, 2000, 0, 0, 8, 1, NULL, NULL, NULL, NULL, true, NOW(), NOW()),
  ('f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1'::UUID, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID, 'Default-PPPoE', 'Default PPPoE speed profile', 20000, 10000, 0, 0, 8, 1, NULL, NULL, NULL, NULL, true, NOW(), NOW()),
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'::UUID, '22222222-2222-2222-2222-222222222222'::UUID, 'Default-PPPoE', 'Default PPPoE speed profile', 50000, 20000, 0, 0, 8, 1, NULL, NULL, NULL, NULL, true, NOW(), NOW())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 14.2 Service Packages (PPPoE monthly + Lite per-device)
INSERT INTO service_packages (
  id, tenant_id, name, category, pricing_model,
  price_monthly, price_per_device, billing_day_default,
  network_profile_id, is_active, metadata,
  created_at, updated_at
) VALUES
  -- Acme (Pro)
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2'::UUID, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, 'Regular 10Mbps', 'regular', 'flat_monthly', 150000, 0, 1, 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3'::UUID, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, 'Business 20Mbps', 'business', 'flat_monthly', 300000, 0, 1, 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4'::UUID, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, 'Enterprise 50Mbps', 'enterprise', 'flat_monthly', 600000, 0, 1, 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5'::UUID, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, 'Lite per-device', 'lite', 'per_device', 0, 25000, NULL, 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'::UUID, true, '{}'::jsonb, NOW(), NOW()),

  -- BasicCo (Basic)
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2'::UUID, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID, 'Regular 5Mbps', 'regular', 'flat_monthly', 120000, 0, 1, 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('d5d5d5d5-d5d5-d5d5-d5d5-d5d5d5d5d5d5'::UUID, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID, 'Lite per-device', 'lite', 'per_device', 0, 20000, NULL, 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1'::UUID, true, '{}'::jsonb, NOW(), NOW()),

  -- BizNet (Business)
  ('f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2'::UUID, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID, 'Regular 20Mbps', 'regular', 'flat_monthly', 180000, 0, 1, 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3'::UUID, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID, 'Business 50Mbps', 'business', 'flat_monthly', 450000, 0, 1, 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('f5f5f5f5-f5f5-f5f5-f5f5-f5f5f5f5f5f5'::UUID, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID, 'Lite per-device', 'lite', 'per_device', 0, 30000, NULL, 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1'::UUID, true, '{}'::jsonb, NOW(), NOW()),

  -- EntCorp (Enterprise)
  ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2'::UUID, '22222222-2222-2222-2222-222222222222'::UUID, 'Enterprise 50Mbps', 'enterprise', 'flat_monthly', 999000, 0, 1, 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'::UUID, true, '{}'::jsonb, NOW(), NOW()),
  ('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5'::UUID, '22222222-2222-2222-2222-222222222222'::UUID, 'Lite per-device', 'lite', 'per_device', 0, 50000, NULL, 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'::UUID, true, '{}'::jsonb, NOW(), NOW())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 14.3 Default global discount setting (disabled)
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{service_discount}',
  '{"enabled": false, "type": "percent", "value": 0}'::jsonb,
  true
)
WHERE slug IN ('acme', 'basicco', 'biznet', 'entcorp');

-- Verify seed data
DO $$
DECLARE
    super_admin_count INTEGER;
    owner_count INTEGER;
    tenant_count INTEGER;
    basic_owner_count INTEGER;
    business_owner_count INTEGER;
    enterprise_owner_count INTEGER;
    service_packages_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO super_admin_count FROM users WHERE email = 'admin@rrnet.test';
    SELECT COUNT(*) INTO owner_count FROM users WHERE email = 'owner@acme.test';
    SELECT COUNT(*) INTO tenant_count FROM tenants WHERE slug = 'acme';
    SELECT COUNT(*) INTO basic_owner_count FROM users WHERE email = 'owner@basicco.test';
    SELECT COUNT(*) INTO business_owner_count FROM users WHERE email = 'owner@biznet.test';
    SELECT COUNT(*) INTO enterprise_owner_count FROM users WHERE email = 'owner@entcorp.test';
    SELECT COUNT(*) INTO service_packages_count FROM service_packages;
    
    RAISE NOTICE 'Seed verification:';
    RAISE NOTICE '  Super Admin accounts: %', super_admin_count;
    RAISE NOTICE '  Owner accounts: %', owner_count;
    RAISE NOTICE '  Tenants: %', tenant_count;
    RAISE NOTICE '  BasicCo owner accounts: %', basic_owner_count;
    RAISE NOTICE '  BizNet owner accounts: %', business_owner_count;
    RAISE NOTICE '  EntCorp owner accounts: %', enterprise_owner_count;
    RAISE NOTICE '  Service packages seeded: %', service_packages_count;
    
    IF super_admin_count = 0 THEN
        RAISE WARNING 'Super Admin account not created!';
    END IF;
    
    IF owner_count = 0 THEN
        RAISE WARNING 'Owner account not created!';
    END IF;
    
    IF tenant_count = 0 THEN
        RAISE WARNING 'Tenant not created!';
    END IF;
END $$;

