#!/bin/bash
set -e

echo "============================================"
echo "  RRNet Backend - Auto Migration Entrypoint"
echo "============================================"

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi

echo ""
echo "[1] Running database migrations..."
echo "    Database: $DATABASE_URL"
echo ""

# Run migrations (dir is relative to /app)
/app/rrnet-migrate -url "$DATABASE_URL" -dir /app/migrations up

MIGRATE_EXIT=$?
if [ $MIGRATE_EXIT -ne 0 ]; then
    echo ""
    echo "❌ Migration failed with exit code $MIGRATE_EXIT"
    exit $MIGRATE_EXIT
fi

echo ""
echo "✅ Migrations complete. Starting API server..."
echo "============================================"
echo ""

# Hand off to the actual API binary, passing through any arguments
exec /app/rrnet-api "$@"
