#!/bin/bash
# =============================================================================
# Quick Fix: Run pending migrations on VPS
# Jalankan script ini di VPS via SSH: bash quick_migrate_vps.sh
# =============================================================================
set -e

PROJECT_DIR="${PROJECT_DIR:-/opt/rrnet}"
ENV_FILE="$PROJECT_DIR/.env"

echo "============================================"
echo "  Quick Migrate VPS - RRNet"
echo "============================================"
echo ""

# --- 1. Load environment ---
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found at $ENV_FILE"
    echo "   Set PROJECT_DIR env var if you installed elsewhere."
    exit 1
fi

# Parse DATABASE_URL from .env
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2-)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in $ENV_FILE"
    exit 1
fi
echo "✓ DATABASE_URL loaded from .env"
echo ""

# --- 2. Check if backend container is running ---
BACKEND_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "backend|rrnet-backend" | head -1)
if [ -z "$BACKEND_CONTAINER" ]; then
    echo "⚠️  No running backend container found."
    echo "   Will try to run migrate directly on host using Go..."
    GO_MODE="host"
else
    echo "✓ Backend container found: $BACKEND_CONTAINER"
    GO_MODE="docker"
fi
echo ""

# --- 3. Run migrations ---
echo "[1] Running migrations..."
echo ""

if [ "$GO_MODE" = "docker" ]; then
    # Check if migrate binary exists in container
    if docker exec "$BACKEND_CONTAINER" test -f /app/rrnet-migrate 2>/dev/null; then
        echo "   Using migrate binary inside container..."
        docker exec -e DATABASE_URL="$DATABASE_URL" "$BACKEND_CONTAINER" \
            /app/rrnet-migrate -url "$DATABASE_URL" -dir /app/migrations up
    else
        echo "   ⚠️  rrnet-migrate binary not found in container."
        echo "   Running via go from source code instead..."
        GO_MODE="host"
    fi
fi

if [ "$GO_MODE" = "host" ]; then
    if ! command -v go &>/dev/null; then
        echo "❌ Go is not installed on this host."
        echo ""
        echo "   Install Go first:"
        echo "     wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz"
        echo "     tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz"
        echo "     export PATH=\$PATH:/usr/local/go/bin"
        echo ""
        echo "   OR rebuild and redeploy the backend image with the new Dockerfile."
        exit 1
    fi

    cd "$PROJECT_DIR/BE"
    echo "   Using: go run cmd/migrate/main.go up"
    DATABASE_URL="$DATABASE_URL" go run cmd/migrate/main.go up
fi

echo ""
echo "============================================"
echo "✅ Migration complete!"
echo "============================================"
echo ""
echo "Next: Restart backend to pick up any changes"
echo "  cd $PROJECT_DIR && docker compose -f docker-compose.production.yml restart backend"
echo ""
