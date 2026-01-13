#!/bin/bash

# Manual Seed Development Data Script
# Inserts development accounts directly to database
# Based on DEVELOPMENT_ACCOUNTS.md

set -e

PROJECT_DIR="/opt/rrnet"
DB_NAME="${DB_NAME:-rrnet_dev}"
DB_USER="${DB_USER:-rrnet}"
DB_PASSWORD="${DB_PASSWORD:-rrnet_secret}"

echo "=========================================="
echo "Seeding Development Data (Manual)"
echo "=========================================="
echo ""

cd "$PROJECT_DIR/BE"

# Check if tables exist
echo "[1] Checking if tables exist..."
TENANTS_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'tenants';
" | xargs)

if [ "$TENANTS_EXISTS" -eq "0" ]; then
    echo "❌ Tables do not exist!"
    echo ""
    echo "Please run migrations first:"
    echo "  1. Fix permissions: ./scripts/fix_db_permissions.sh"
    echo "  2. Run migrations: PGPASSWORD=rrnet_secret ./scripts/run_migrations.sh"
    exit 1
fi

echo "✓ Tables exist"
echo ""

# Use seed file if exists, otherwise manual insert
if [ -f "migrations/seed/001_dev_accounts.sql" ]; then
    echo "[2] Using seed file: migrations/seed/001_dev_accounts.sql"
    echo "    Running seed script..."
    echo ""
    
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -f migrations/seed/001_dev_accounts.sql
    
    echo ""
    echo "✓ Seed file executed"
else
    echo "[2] Seed file not found, inserting manually..."
    echo ""
    
    # Manual insert (simplified version)
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost << 'EOF'
-- Insert Super Admin
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
    NULL,
    r.id,
    'admin@rrnet.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni',
    'Super Admin',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'super_admin'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@rrnet.test')
LIMIT 1;

-- Insert Tenant: Acme Networks
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

-- Assign Pro plan to Acme
UPDATE tenants t
SET plan_id = p.id
FROM plans p
WHERE t.slug = 'acme'
  AND p.code = 'pro'
  AND t.plan_id IS NULL;

-- Insert Owner for Acme
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT 
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
    r.id,
    'owner@acme.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni',
    'Owner Acme',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'owner'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'owner@acme.test')
LIMIT 1;

EOF
    echo "✓ Manual insert completed"
fi

echo ""
echo "[3] Verifying inserted data..."
echo ""

# Verify
SUPER_ADMIN=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "
SELECT COUNT(*) FROM users WHERE email = 'admin@rrnet.test';
" | xargs)

OWNER_ACME=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "
SELECT COUNT(*) FROM users WHERE email = 'owner@acme.test';
" | xargs)

TENANT_ACME=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "
SELECT COUNT(*) FROM tenants WHERE slug = 'acme';
" | xargs)

echo "   Super Admin (admin@rrnet.test): $SUPER_ADMIN"
echo "   Owner Acme (owner@acme.test): $OWNER_ACME"
echo "   Tenant Acme: $TENANT_ACME"
echo ""

echo "=========================================="
echo "Development Data Seeded!"
echo "=========================================="
echo ""
echo "Accounts available:"
echo "  Super Admin: admin@rrnet.test / password"
echo "  Acme Owner:  owner@acme.test / password"
echo ""
echo "Access URLs:"
echo "  Frontend: http://72.60.74.209:3000"
echo "  Backend:  http://72.60.74.209:8080"
echo ""

