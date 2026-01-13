#!/bin/bash

# Fix Database Permissions Script
# Grants necessary permissions to rrnet user

set -e

DB_NAME="${DB_NAME:-rrnet_dev}"
DB_USER="${DB_USER:-rrnet}"

echo "=========================================="
echo "Fixing Database Permissions"
echo "=========================================="
echo ""

echo "[1] Granting permissions to user $DB_USER..."

# Connect as postgres user and grant permissions
sudo -u postgres psql << EOF
-- Grant schema usage and create privileges
GRANT USAGE ON SCHEMA public TO $DB_USER;
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Make user owner of public schema (safer for development)
ALTER SCHEMA public OWNER TO $DB_USER;

-- Grant privileges on all existing tables (if any)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

\q
EOF

echo "✓ Permissions granted"
echo ""

echo "[2] Verifying permissions..."
sudo -u postgres psql -d $DB_NAME -c "
SELECT 
    nspname as schema,
    nspowner::regrole as owner
FROM pg_namespace 
WHERE nspname = 'public';
"

echo ""
echo "=========================================="
echo "Permissions Fixed!"
echo "=========================================="
echo ""
echo "Now you can run migrations:"
echo "  PGPASSWORD=rrnet_secret ./scripts/run_migrations.sh"
echo ""

