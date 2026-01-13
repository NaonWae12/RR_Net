#!/bin/bash

# Import Development Data Script
# Imports data from SQL dump to VPS database
# Usage: ./scripts/import_dev_data.sh <dump_file.sql>

set -e

PROJECT_DIR="/opt/rrnet"
VPS_IP="72.60.74.209"

# Database connection (from VPS .env or default)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-rrnet_dev}"
DB_USER="${DB_USER:-rrnet}"

# Try to read password from .env file if exists
if [ -f "$PROJECT_DIR/BE/.env" ]; then
    # Extract password from DATABASE_URL if exists
    DB_PASSWORD=$(grep "^DATABASE_URL=" "$PROJECT_DIR/BE/.env" | sed -n 's/.*:\([^@]*\)@.*/\1/p' 2>/dev/null || echo "")
fi

# Use default password if not set
DB_PASSWORD="${DB_PASSWORD:-rrnet_secret}"

echo "=========================================="
echo "Import Development Data"
echo "=========================================="
echo ""

# Check if dump file is provided
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <dump_file.sql>"
    echo ""
    echo "Example:"
    echo "  $0 dev_data_export_20250113_120000.sql"
    exit 1
fi

DUMP_FILE="$1"

# Check if file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ File not found: $DUMP_FILE"
    echo ""
    echo "Available files:"
    ls -lh *.sql 2>/dev/null | head -10 || echo "  No .sql files found"
    exit 1
fi

echo "[1] Checking database connection..."
echo "    Host: $DB_HOST:$DB_PORT"
echo "    Database: $DB_NAME"
echo "    User: $DB_USER"
echo "    Password: ${DB_PASSWORD:+***hidden***}"
echo ""

# Test connection
if ! PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ Cannot connect to database!"
    echo ""
    echo "Please check:"
    echo "  1. PostgreSQL is running: systemctl status postgresql"
    echo "  2. Database exists: psql -U $DB_USER -d postgres -c '\l'"
    echo "  3. User has permissions"
    echo ""
    echo "Or set environment variables:"
    echo "  export DB_HOST=localhost"
    echo "  export DB_PORT=5432"
    echo "  export DB_NAME=rrnet"
    echo "  export DB_USER=rrnet"
    echo "  export DB_PASSWORD=your_password"
    exit 1
fi

echo "✓ Database connection OK"
echo ""

# Get file size
FILE_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[2] Importing data..."
echo "    File: $DUMP_FILE"
echo "    Size: $FILE_SIZE"
echo "    This may take a few minutes..."
echo ""

# Backup current data (optional, but recommended)
BACKUP_FILE="backup_before_import_$(date +%Y%m%d_%H%M%S).sql"
echo "[2.1] Creating backup of current data..."
echo "      Backup: $BACKUP_FILE"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_FILE" 2>/dev/null || echo "⚠️  Backup failed (non-critical)"
echo ""

# Disable foreign key checks temporarily (PostgreSQL doesn't have this, but we'll handle errors)
echo "[2.2] Importing data..."
echo ""

# Import data
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$DUMP_FILE" \
    2>&1 | tee import_log.txt

IMPORT_EXIT_CODE=${PIPESTATUS[0]}

# Check for critical errors (ignore duplicate key errors as they're expected)
if [ $IMPORT_EXIT_CODE -ne 0 ]; then
    ERROR_COUNT=$(grep -i "error" import_log.txt | grep -v "duplicate key\|already exists" | wc -l || echo "0")
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo ""
        echo "⚠️  Import completed with some errors"
        echo "    Check import_log.txt for details"
        echo ""
        echo "Common non-critical errors:"
        echo "  - 'duplicate key' = Data already exists (OK)"
        echo "  - 'already exists' = Data already exists (OK)"
        echo ""
    else
        echo ""
        echo "✓ Import completed (warnings are OK)"
    fi
else
    echo ""
    echo "✓ Import completed successfully!"
fi

# Verify import
echo ""
echo "[3] Verifying imported data..."
echo ""

TABLES=(
    "tenants"
    "users"
    "clients"
    "invoices"
    "payments"
    "service_packages"
    "network_profiles"
    "client_groups"
)

for table in "${TABLES[@]}"; do
    COUNT=$(PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    if [ -n "$COUNT" ]; then
        echo "    $table: $COUNT rows"
    fi
done

echo ""
echo "=========================================="
echo "Import Complete!"
echo "=========================================="
echo ""
echo "Development accounts available:"
echo "  Super Admin: admin@rrnet.test / password"
echo "  Acme Owner:  owner@acme.test / password"
echo ""
echo "Access URLs:"
echo "  Frontend: http://$VPS_IP:3000"
echo "  Backend:  http://$VPS_IP:8080"
echo ""
echo "Files:"
echo "  Dump file: $DUMP_FILE"
echo "  Backup:    $BACKUP_FILE"
echo "  Log:       import_log.txt"
echo ""

