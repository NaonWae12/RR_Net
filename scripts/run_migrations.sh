#!/bin/bash

# Run Database Migrations Script
# Creates all database tables before importing data

set -e

PROJECT_DIR="/opt/rrnet"
DB_NAME="${DB_NAME:-rrnet_dev}"
DB_USER="${DB_USER:-rrnet}"
DB_PASSWORD="${DB_PASSWORD:-rrnet_secret}"

echo "=========================================="
echo "Running Database Migrations"
echo "=========================================="
echo ""

cd "$PROJECT_DIR/BE"

# Check if migrations directory exists
if [ ! -d "migrations" ]; then
    echo "❌ Migrations directory not found!"
    echo "   Expected: $PROJECT_DIR/BE/migrations"
    exit 1
fi

echo "[1] Installing PostgreSQL extensions..."
if [ -f "migrations/init/001_init_extensions.sql" ]; then
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -f migrations/init/001_init_extensions.sql 2>&1 | grep -v "already exists" || true
    echo "✓ Extensions installed"
else
    echo "⚠️  Extensions file not found"
fi
echo ""

echo "[2] Running migrations..."
MIGRATION_COUNT=0
MIGRATION_SUCCESS=0
MIGRATION_FAILED=0

# Run migrations in order
for migration in migrations/000*.up.sql; do
    if [ -f "$migration" ]; then
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
        MIGRATION_NAME=$(basename "$migration")
        echo "  [$MIGRATION_COUNT] Running $MIGRATION_NAME..."
        
        # Run migration and capture output (don't suppress errors)
        OUTPUT=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -f "$migration" 2>&1)
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
            # Check for errors in output even if exit code is 0
            if echo "$OUTPUT" | grep -qi "error\|fatal"; then
                echo "    ❌ $MIGRATION_NAME has errors!"
                echo "       Error: $(echo "$OUTPUT" | grep -i "error\|fatal" | head -2)"
                MIGRATION_FAILED=$((MIGRATION_FAILED + 1))
            elif echo "$OUTPUT" | grep -qi "already exists\|duplicate\|relation.*already exists"; then
                echo "    ⚠️  $MIGRATION_NAME (table/object may already exist - OK)"
                MIGRATION_SUCCESS=$((MIGRATION_SUCCESS + 1))
            else
                echo "    ✓ $MIGRATION_NAME completed"
                MIGRATION_SUCCESS=$((MIGRATION_SUCCESS + 1))
            fi
        else
            # Check if it's a "already exists" error (non-fatal)
            if echo "$OUTPUT" | grep -qi "already exists\|duplicate\|relation.*already exists"; then
                echo "    ⚠️  $MIGRATION_NAME (already exists - OK)"
                MIGRATION_SUCCESS=$((MIGRATION_SUCCESS + 1))
            else
                echo "    ❌ $MIGRATION_NAME failed!"
                echo "       Exit code: $EXIT_CODE"
                echo "       Error: $(echo "$OUTPUT" | grep -v "^$" | head -5)"
                MIGRATION_FAILED=$((MIGRATION_FAILED + 1))
            fi
        fi
    fi
done

echo ""
echo "=========================================="
echo "Migration Summary"
echo "=========================================="
echo "Total migrations: $MIGRATION_COUNT"
echo "Successful: $MIGRATION_SUCCESS"
echo "Failed: $MIGRATION_FAILED"
echo ""

if [ $MIGRATION_COUNT -eq 0 ]; then
    echo "⚠️  No migration files found!"
    echo "   Expected files: migrations/000*.up.sql"
    exit 1
fi

if [ $MIGRATION_FAILED -gt 0 ]; then
    echo "⚠️  Some migrations failed. Check errors above."
    exit 1
fi

echo "✓ All migrations completed successfully!"
echo ""

# Verify tables were created
echo "[3] Verifying tables..."
TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
" | xargs)

echo "   Tables created: $TABLES"
echo ""

# List some key tables
echo "[4] Key tables:"
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('tenants', 'users', 'roles', 'clients', 'invoices', 'payments')
ORDER BY table_name;
" | sed 's/^/   - /'

echo ""
echo "=========================================="
echo "Migrations Complete!"
echo "=========================================="
echo ""
echo "Next step: Import development data"
echo "  ./scripts/import_dev_data.sh dev_data_export_*.sql"
echo ""

