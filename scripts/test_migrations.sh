#!/bin/bash

# Test Migrations - Run one migration to see actual output

set -e

DB_NAME="${DB_NAME:-rrnet_dev}"
DB_USER="${DB_USER:-rrnet}"
DB_PASSWORD="${DB_PASSWORD:-rrnet_secret}"

if [ -z "$1" ]; then
    echo "Usage: $0 <migration_file.sql>"
    echo "Example: $0 BE/migrations/000001_create_tenants.up.sql"
    exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ File not found: $MIGRATION_FILE"
    exit 1
fi

echo "=========================================="
echo "Testing Migration: $MIGRATION_FILE"
echo "=========================================="
echo ""

echo "Running migration (showing full output)..."
echo ""

PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -f "$MIGRATION_FILE"

echo ""
echo "=========================================="
echo "Checking if table was created..."
echo "=========================================="

# Extract table name from migration
TABLE_NAME=$(grep -i "CREATE TABLE" "$MIGRATION_FILE" | sed -n 's/.*CREATE TABLE.*IF NOT EXISTS \([a-z_]*\).*/\1/pi' | head -1)
if [ -z "$TABLE_NAME" ]; then
    TABLE_NAME=$(grep -i "CREATE TABLE" "$MIGRATION_FILE" | sed -n 's/.*CREATE TABLE \([a-z_]*\).*/\1/pi' | head -1)
fi

if [ -n "$TABLE_NAME" ]; then
    echo "Looking for table: $TABLE_NAME"
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -c "\d $TABLE_NAME" 2>&1
else
    echo "Could not determine table name from migration"
fi

echo ""
echo "All tables in database:"
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" -h localhost -c "\dt" 2>&1

